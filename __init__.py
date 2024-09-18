from server import PromptServer
import os
from aiohttp import web
import aiohttp
import folder_paths
import hashlib
import json
import requests
import logging

datapath = os.path.join(os.path.dirname(__file__), 'sliderImages')

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Fancy sliderData versioning settings
REPO_OWNER = "Kinglord"
REPO_NAME = "ComfyUI_Slider_Sidebar"
SLIDER_DATA_DIR = "sliderData"
BASE_RAW_URL = f"https://raw.githubusercontent.com/{REPO_OWNER}/{REPO_NAME}/main"
API_BASE_URL = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}"
LOCAL_SLIDER_DATA_DIR = os.path.join(os.path.dirname(__file__), SLIDER_DATA_DIR)


def get_local_version():
    version_file = os.path.join(LOCAL_SLIDER_DATA_DIR, "version.json")
    logger.debug(f"Checking local version file: {version_file}")
    try:
        with open(version_file, 'r') as f:
            data = json.load(f)
            version = data.get('version', 0)
            logger.debug(f"Local version: {version}")
            return version
    except FileNotFoundError:
        logger.warning("Local version file not found. Returning 0.")
        return 0

def get_remote_version():
    url = f"{BASE_RAW_URL}/{SLIDER_DATA_DIR}/version.json"
    logger.debug(f"Fetching remote version from: {url}")
    try:
        response = requests.get(url)
        logger.debug(f"Remote version response status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            version = data.get('version', 0)
            logger.debug(f"Remote version: {version}")
            return version
    except Exception as e:
        logger.error(f"Error fetching remote version: {str(e)}")
    logger.warning("Failed to get remote version. Returning 0.")
    return 0

@PromptServer.instance.routes.get("/slider_sidebar/version")
async def get_slider_version(request):
    version_type = request.query.get('type', 'local')
    logger.debug(f"Received request for {version_type} slider version")

    if version_type == 'local':
        version = get_local_version()
        logger.debug(f"Returning local slider version: {version}")
    elif version_type == 'remote':
        version = get_remote_version()
        logger.debug(f"Returning remote slider version: {version}")
    else:
        logger.warning(f"Invalid version type requested: {version_type}")
        return web.json_response({"error": "Invalid version type"}, status=400)

    return web.json_response({"version": version})

@PromptServer.instance.routes.post("/slider_sidebar/update")
async def update_slider_data(request):
    logger.debug("Received request to update slider data")
    try:
        remote_version = get_remote_version()
        local_version = get_local_version()
        logger.info(f"Comparing versions - Local: {local_version}, Remote: {remote_version}")

        if remote_version > local_version:
            logger.info("Update needed. Fetching file list from GitHub.")
            
            # Special handling for missing version.json
            if local_version == 0:
                logger.warning("version.json is missing. Creating a placeholder.")
                version_file_path = os.path.join(LOCAL_SLIDER_DATA_DIR, 'version.json')
                with open(version_file_path, 'w') as f:
                    json.dump({"version": 0}, f)
                logger.debug("Placeholder version.json created.")

            repo_url = f"{API_BASE_URL}/contents/{SLIDER_DATA_DIR}"
            response = requests.get(repo_url)
            if response.status_code != 200:
                raise Exception("Failed to fetch file list from GitHub")

            files_to_update = [file['name'] for file in response.json() if file['name'].endswith('.json') and file['name'] != 'version.json']
            files_to_update.append('version.json')  # Add version.json as the last file to update
            logger.debug(f"Files to update: {files_to_update}")

            for filename in files_to_update:
                url = f"{BASE_RAW_URL}/{SLIDER_DATA_DIR}/{filename}"
                logger.debug(f"Downloading file: {url}")
                response = requests.get(url)
                if response.status_code != 200:
                    raise Exception(f"Failed to download {filename}")

                file_path = os.path.join(LOCAL_SLIDER_DATA_DIR, filename)
                with open(file_path, 'wb') as f:
                    f.write(response.content)
                logger.debug(f"Successfully updated file: {filename}")

            logger.info("Update successful")
            return web.json_response({"message": "Update successful", "new_version": remote_version})
        else:
            logger.info("Already up to date")
            return web.json_response({"message": "Already up to date"})
    except Exception as e:
        logger.error(f"Error updating slider data: {str(e)}")
        return web.json_response({"error": str(e)}, status=500)


@PromptServer.instance.routes.get("/slider_sidebar/data")
async def get_slider_data(request):
    all_sliders = []

    try:
        for filename in os.listdir(LOCAL_SLIDER_DATA_DIR):
            if filename.endswith('.json'):
                with open(os.path.join(LOCAL_SLIDER_DATA_DIR, filename), 'r') as file:
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