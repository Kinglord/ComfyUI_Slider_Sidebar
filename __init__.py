from server import PromptServer
import os
from aiohttp import web
import aiohttp
import folder_paths
import hashlib
import json

datapath = os.path.join(os.path.dirname(__file__), 'sliderImages')

@PromptServer.instance.routes.get("/slider_sidebar/data")
async def get_slider_data(request):
    data_dir = os.path.join(os.path.dirname(__file__), "sliderData")
    all_sliders = []

    try:
        for filename in os.listdir(data_dir):
            if filename.endswith('.json'):
                with open(os.path.join(data_dir, filename), 'r') as file:
                    file_data = json.load(file)
                    if isinstance(file_data, list):
                        # Filter out the "Example Slider"
                        filtered_data = [slider for slider in file_data if slider.get('name') != "Example Slider"]
                        all_sliders.extend(filtered_data)
                    elif isinstance(file_data, dict) and 'sliders' in file_data:
                        # Filter out the "Example Slider" if it's in a 'sliders' key
                        filtered_data = [slider for slider in file_data['sliders'] if slider.get('name') != "Example Slider"]
                        all_sliders.extend(filtered_data)

        return web.json_response({"sliders": all_sliders})
    except Exception as e:
        print(f"Error reading slider data: {str(e)}")
        return web.Response(text="Error reading slider data", status=500)

@PromptServer.instance.routes.get("/loras/list")
async def list_loras(request):
    # Get the directories where LoRA files are stored
    lora_dirs = folder_paths.get_folder_paths("loras")
    lora_files = []
    
    for lora_dir in lora_dirs:
        if os.path.exists(lora_dir):
            for filename in os.listdir(lora_dir):
                file_path = os.path.join(lora_dir, filename)
                if os.path.isfile(file_path):
                    lora_files.append({"filename": filename, "path": file_path})
                    
    return web.json_response(lora_files)

@PromptServer.instance.routes.post("/loras/download")
async def download_lora(request):
    try:
        data = await request.json()
        model_id = data.get('modelId')
        api_key = data.get('apiKey')  # Extract the API key
        if not model_id:
            return web.json_response({'message': 'Missing modelId in request'}, status=400)

        # Validate model_id
        try:
            model_id = int(model_id)
        except ValueError:
            return web.json_response({'message': 'Invalid modelId'}, status=400)

        # Call the function to download the LoRA model
        success, message = await download_lora_model(model_id, api_key)
        if success:
            return web.json_response({'message': 'Download successful'})
        else:
            return web.json_response({'message': message}, status=500)
    except Exception as e:
        print(f"Error in download_lora endpoint: {str(e)}")
        return web.json_response({'message': 'An error occurred on the server'}, status=500)
    
@PromptServer.instance.routes.post("/hash_lora")
async def hash_lora(request):
    data = await request.json()
    filepath = data.get('filepath')
    if not filepath:
        return web.json_response({'error': 'No filepath provided'}, status=400)
    
    try:
        sha256_hash = hashlib.sha256()
        with open(filepath, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        file_hash = sha256_hash.hexdigest()
        return web.json_response({'hash': file_hash})
    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)


async def download_lora_model(model_id, api_key=None):
    try:
        # Set up the headers
        headers = {
            'Content-Type': 'application/json'
        }
        if api_key:
            headers['Authorization'] = f'Bearer {api_key}'

        # Fetch the model by ID
        async with aiohttp.ClientSession() as session:
            model_url = f'https://civitai.com/api/v1/models/{model_id}'

            async with session.get(model_url, headers=headers) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    print(f"Failed to fetch model: {resp.status} {error_text}")
                    if resp.status == 401:
                        return False, 'Authentication required to access this model. Please provide a valid API key.'
                    return False, f'Failed to fetch model: {resp.status}'
                model_data = await resp.json()
                model_name = model_data.get('name', f'Model_{model_id}')
                print(f"Fetched model: {model_name} (ID: {model_id})")

                # Get the latest model version
                model_versions = model_data.get('modelVersions', [])
                if not model_versions:
                    return False, 'No versions found for this model'

                # Assuming the latest version is the one with the newest 'createdAt' date
                latest_version = max(model_versions, key=lambda v: v['createdAt'])
                model_version_id = latest_version['id']
                print(f"Using latest model version ID: {model_version_id}")

                # Get the download URL from the files in the model version
                files = latest_version.get('files', [])
                if not files:
                    return False, 'No files found for this model version'

                # Select the primary file or the first file
                model_file = next((f for f in files if f.get('primary')), files[0])
                download_url = model_file.get('downloadUrl')
                if not download_url:
                    return False, 'Download URL not found for the selected file'
                print(f"Download URL: {download_url}")

                # Download the model file
                async with session.get(download_url, headers=headers) as download_resp:
                    if download_resp.status != 200:
                        error_text = await download_resp.text()
                        print(f"Failed to download model: {download_resp.status} {error_text}")
                        if download_resp.status == 401:
                            return False, 'Authentication required to download this model. Please provide a valid API key.'
                        return False, f'Failed to download model: {download_resp.status}'

                    # Get the content disposition to find the filename
                    content_disposition = download_resp.headers.get('Content-Disposition', '')
                    if 'filename=' in content_disposition:
                        filename = content_disposition.split('filename=')[-1].strip('"')
                    else:
                        # Use the model name as the filename if content-disposition is missing
                        filename = f"{model_name}.safetensors"

                    # Sanitize the filename
                    filename = os.path.basename(filename)
                    print(f"Saving as filename: {filename}")

                    # Save the file to the LoRA directory
                    lora_dirs = folder_paths.get_folder_paths("loras")
                    if not lora_dirs:
                        return False, 'No LoRA directory found'
                    save_path = os.path.join(lora_dirs[0], filename)

                    # Write the content to the file
                    with open(save_path, 'wb') as f:
                        while True:
                            chunk = await download_resp.content.read(1024)
                            if not chunk:
                                break
                            f.write(chunk)

        return True, 'Download successful'
    except Exception as e:
        print(f"Error downloading LoRA model: {str(e)}")
        return False, f'An error occurred: {str(e)}'


NODE_CLASS_MAPPINGS = {

}

NODE_DISPLAY_NAME_MAPPINGS = {

}

WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]