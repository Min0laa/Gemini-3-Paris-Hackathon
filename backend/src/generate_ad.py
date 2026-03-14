import io
import os
import time
from pathlib import Path
from google import genai
from google.genai import types
from PIL import Image
import uuid
import cv2

IMAGES_DIR = Path(__file__).parent / "images"
VIDEOS_DIR = Path(__file__).parent / "videos"
IMAGES_DIR.mkdir(exist_ok=True)
VIDEOS_DIR.mkdir(exist_ok=True)

def intro_prompt(product_name, script):
  return (
      f"Generate a fast-paced, photo-realistic video transition perfectly interpolating between the first and last provided reference images. "
      f"Strictly maintain the exact location, environment, subject, lighting, and overall visual style present in the reference images. "
      f"The subject smoothly transitions from their pose in the first image by reaching down, pulling out {product_name}, and presenting it to the camera exactly as shown in the final image. "
      f"The natively generated audio features a casual, conversational, and friendly voice speaking directly to the viewer, with absolutely no background sound effects (no SFX). "
      f"The subject says, in English: \"{script}\""
  )

def outro_prompt(product_name, script):
  return (
      f"Generate a fast-paced, photo-realistic video transition perfectly interpolating from the first reference image (subject presenting product) to the last reference image (subject in a normal/resting pose, product absent). "
      f"Strictly maintain consistency with the environment, lighting, and subject identity established in the reference images. "
      f"The subject begins by holding {product_name}, finishes speaking, and then smoothly transitions by moving their hands down to place the product back out of frame, returning to the exact resting pose and position shown in the final reference image. "
      f"The natively generated audio features a casual, conversational, and friendly voice speaking directly to the viewer. There are absolutely no background sound effects (no SFX). "
      f"The subject says, in English: \"{script}\""
  )

def generate_composite(client, product_path, setting_path, prompt, output_path=None):
  """
  Compose a product image into a setting image using Gemini image editing.

  Args:
    client: genai.Client instance
    product_path: path to the product image
    setting_path: path to the setting/scene image
    prompt: instruction describing how to place the product in the scene
    output_path: where to save the result (defaults to a uuid .png)

  Returns:
    Path to the saved composite image
  """
  product_img = Image.open(product_path)
  setting_img = Image.open(setting_path)

  response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents=[
      prompt,
      product_img,
      setting_img,
    ],
    config=types.GenerateContentConfig(
      response_modalities=["TEXT", "IMAGE"],
    ),
  )

  for part in response.candidates[0].content.parts:
    if part.inline_data is not None:
      image = Image.open(io.BytesIO(part.inline_data.data))
      out = output_path or str(IMAGES_DIR / (str(uuid.uuid4()) + ".png"))
      image.save(out)
      return out

  raise RuntimeError("No image returned by the model")


def composite_prompt(product_name):
  return (
      f"Create a new image by combining the elements from the provided images. "
      f"Take the {product_name} in the first image and place it in the hands of the main person in the second image. "
      f"The final image should be a photo-realistic shot of the person holding the {product_name} in their hands, presenting it. "
      f"Make sure that the product's size is realistic compared to the person's size."
  )


def merge_videos(video_paths, output_path=None):
  caps = [cv2.VideoCapture(p) for p in video_paths]

  fps = caps[0].get(cv2.CAP_PROP_FPS)
  width = int(caps[0].get(cv2.CAP_PROP_FRAME_WIDTH))
  height = int(caps[0].get(cv2.CAP_PROP_FRAME_HEIGHT))

  out_path = output_path or str(VIDEOS_DIR / (str(uuid.uuid4()) + ".mp4"))
  writer = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))

  for cap in caps:
    while True:
      ret, frame = cap.read()
      if not ret:
        break
      writer.write(frame)
    cap.release()

  writer.release()
  return out_path


def generate_ad(client, intro_path, outro_path, product_path, product_name, intro_script, outro_script, existing_composite=None):
  """
  Full ad generation pipeline:
    1. Composite the product into the intro frame (skipped if existing_composite is provided)
    2. Generate intro video interpolation (intro -> composite)
    3. Generate outro video interpolation (composite -> outro)

  Returns:
    Path to the final merged video
  """
  if existing_composite:
    print(f"Using existing composite: {existing_composite}")
    intro_composite_path = existing_composite
  else:
    print("Compositing product into intro frame...")
    intro_composite_path = generate_composite(
      client=client,
      product_path=product_path,
      setting_path=intro_path,
      prompt=composite_prompt(product_name),
    )

  print("Generating intro video...")
  intro_video_path = generate_interpolation(
    client=client,
    prompt=intro_prompt(product_name=product_name, script=intro_script),
    start_path=intro_path,
    end_path=intro_composite_path,
  )

  print("Generating outro video...")
  outro_video_path = generate_interpolation(
    client=client,
    prompt=outro_prompt(product_name=product_name, script=outro_script),
    start_path=intro_composite_path,
    end_path=outro_path,
  )

  print("Merging videos...")
  final_video_path = merge_videos([intro_video_path, outro_video_path])

  return final_video_path


def _mime_type(path):
  return "image/png" if str(path).lower().endswith(".png") else "image/jpeg"


def generate_interpolation(client, prompt, start_path, end_path):
  with open(start_path, "rb") as f:
    first_image = types.Image(image_bytes=f.read(), mime_type=_mime_type(start_path))
  with open(end_path, "rb") as f:
    last_image = types.Image(image_bytes=f.read(), mime_type=_mime_type(end_path))

  operation = client.models.generate_videos(
    model="veo-3.1-fast-generate-preview",
    prompt=prompt,
    image=first_image,
    config=types.GenerateVideosConfig(
      last_frame=last_image
    ),
  )

  while not operation.done:
    print("Waiting...")
    time.sleep(10)
    operation = client.operations.get(operation)

  if operation.response is None:
    raise RuntimeError(f"Video generation failed: {operation.error}")

  if not operation.response.generated_videos:
    raise RuntimeError(f"Video generation returned no videos. Full response: {operation.response}")

  video = operation.response.generated_videos[0]
  client.files.download(file=video.video)
  out = str(VIDEOS_DIR / (str(uuid.uuid4()) + ".mp4"))
  video.video.save(out)
  return out


if __name__ == "__main__":
  import argparse

  parser = argparse.ArgumentParser()
  parser.add_argument("--composite-name", default=None, help="Name of an existing composite image in images/ to skip the compositing step")
  args = parser.parse_args()

  client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

  existing_composite = str(IMAGES_DIR / args.composite_name) if args.composite_name else None

  final_video = generate_ad(
    client=client,
    intro_path=str(IMAGES_DIR / "use_first.jpg"),
    outro_path=str(IMAGES_DIR / "use_second.jpg"),
    product_path=str(IMAGES_DIR / "nike.png"),
    product_name="Nike Kiger 10 Shoes",
    intro_script="Tired of slipping on muddy trails? You need the new Nike Kiger 10. They are super lightweight and pack absolute monster grip. ",
    outro_script="These keep you completely locked in, so you can just focus on flying. Ready to upgrade your trail run? Hit the link below! ",
    existing_composite=existing_composite,
  )

  print(f"Final video: {final_video}")

  client.close()
