import io
import time
from pathlib import Path
from google import genai
from google.genai import types
from PIL import Image
import uuid
import cv2

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
    model="gemini-2.0-flash-preview-image-generation",
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
      out = output_path or (str(uuid.uuid4()) + ".png")
      image.save(out)
      return out

  raise RuntimeError("No image returned by the model")


def composite_prompt(product_name):
  return (
      f"Naturally insert {product_name} into this scene. "
      f"The product must match the scene's lighting, perspective, and shadows. "
      f"Keep the subject and background exactly as they are — only add the product."
  )


def merge_videos(video_paths, output_path=None):
  caps = [cv2.VideoCapture(p) for p in video_paths]

  fps = caps[0].get(cv2.CAP_PROP_FPS)
  width = int(caps[0].get(cv2.CAP_PROP_FRAME_WIDTH))
  height = int(caps[0].get(cv2.CAP_PROP_FRAME_HEIGHT))

  out_path = output_path or (str(uuid.uuid4()) + ".mp4")
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


def generate_ad(client, intro_path, outro_path, product_path, product_name, script):
  """
  Full ad generation pipeline:
    1. Composite the product into the intro frame
    2. Composite the product into the outro frame
    3. Generate intro video interpolation (subject pulls out product)
    4. Generate outro video interpolation (subject puts product away)

  Returns:
    Tuple of (intro_video_path, outro_video_path)
  """
  comp_prompt = composite_prompt(product_name)

  print("Compositing product into intro frame...")
  intro_composite_path = generate_composite(
    client=client,
    product_path=product_path,
    setting_path=intro_path,
    prompt=comp_prompt,
  )

  print("Compositing product into outro frame...")
  outro_composite_path = generate_composite(
    client=client,
    product_path=product_path,
    setting_path=outro_path,
    prompt=comp_prompt,
  )

  print("Generating intro video...")
  intro_video_path = generate_interpolation(
    client=client,
    prompt=intro_prompt(product_name=product_name, script=script),
    start_path=intro_path,
    end_path=intro_composite_path,
  )

  print("Generating outro video...")
  outro_video_path = generate_interpolation(
    client=client,
    prompt=outro_prompt(product_name=product_name, script=script),
    start_path=outro_composite_path,
    end_path=outro_path,
  )

  print("Merging videos...")
  final_video_path = merge_videos([intro_video_path, outro_video_path])

  return final_video_path


def generate_interpolation(client, prompt, start_path, end_path):
  with open(start_path, "rb") as f:
    first_image = types.Image(image_bytes=f.read(), mime_type="image/jpeg")
  with open(end_path, "rb") as f:
    last_image = types.Image(image_bytes=f.read(), mime_type="image/jpeg")

  operation = client.models.generate_videos(
    model="veo-3.1-generate-preview",
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

  video = operation.response.generated_videos[0]
  client.files.download(file=video.video)
  out = str(uuid.uuid4()) + ".mp4"
  video.video.save(out)
  return out


if __name__ == "__main__":
  client = genai.Client()

  final_video = generate_ad(
    client=client,
    intro_path="intro.jpg",
    outro_path="outro.jpg",
    product_path="product.png",
    product_name="your product",
    script="your script",
  )

  print(f"Final video: {final_video}")

  client.close()
