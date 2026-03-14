import time 
from google import genai 
from google.genai import types 
import uuid

INTRO_PROMPT = f"Generate a fast-paced, photo-realistic video transition perfectly interpolating between the first and last provided reference images." \
    + "Strictly maintain the exact location, environment, subject, lighting, and overall visual style present in the reference images." \
    + "The subject smoothly transitions from their pose in the first image by reaching down, pulling out {product_name}, and presenting it to the camera exactly as shown in the final image." \
    + "The natively generated audio features a casual, conversational, and friendly voice speaking directly to the viewer, with absolutely no background sound effects (no SFX)." \
    + "The subject says, in English: \"{script}\""

def generate_interpolation(client, product_name, script, prompt, start_path, end_path):


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
  video.video.save(str(uuid.uuid4()) + ".mp4")


if __name__ == "__main__":
  client = genai.Client()
  generate_composite(client)
  # generate_interpolation(client=client)
  generate_outra


  client.close()
