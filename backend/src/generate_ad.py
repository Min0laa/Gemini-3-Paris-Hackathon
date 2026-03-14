import time 
from google import genai 
from google.genai import types 

client = genai.Client()

prompt = "my prompt"

operation = client.models.generate_videos(
  model="veo-3.1-generate-preview",
  prompt=prompt,
  image=first_image,
  config=types.GenerateVideosConfig(
    last_frame=last_image
  ),
)

client.close()
