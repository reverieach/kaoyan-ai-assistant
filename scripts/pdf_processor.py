import os
import re
import base64
import glob
from concurrent.futures import ThreadPoolExecutor
from openai import OpenAI

# Configuration
API_KEY = "YOUR_OPENAI_COMPATIBLE_KEY" # e.g. DeepSeek / Qwen
BASE_URL = "https://api.deepseek.com"  # e.g.
MODEL_NAME = "deepseek-coder" # or qwen-vl

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def describe_image(image_path):
    try:
        base64_image = encode_image(image_path)
        
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "你是计算机考研助教。请简练描述这张图的结构、数据流或数学含义，用于RAG检索。不要废话。"},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            },
                        },
                    ],
                }
            ],
            max_tokens=300,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error describing {image_path}: {e}")
        return "图片描述生成失败"

def process_markdown_file(file_path):
    print(f"Processing {file_path}...")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all images: ![alt](path)
    # This regex is simple; might need adjustment for complex paths
    images = re.findall(r'!\[.*?\]\((.*?)\)', content)
    
    if not images:
        print("No images found.")
        return

    # Helper to process one image
    def process_single_image(img_path):
        # Resolve absolute path if needed
        # Assuming img_path is relative to the markdown file
        base_dir = os.path.dirname(file_path)
        abs_img_path = os.path.join(base_dir, img_path)
        
        if not os.path.exists(abs_img_path):
            return None
            
        description = describe_image(abs_img_path)
        return (img_path, description)

    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(process_single_image, images))

    # Replace content
    new_content = content
    for res in results:
        if res:
            img_path, desc = res
            # Insert description after the image link
            # We look for the exact string `](img_path)` to ensure we match the right one
            # Note: This simple replace might fail if same image appears twice.
            
            replacement = f"]({img_path})\n> **[AI图解]** {desc}\n"
            new_content = new_content.replace(f"]({img_path})", replacement)

    # Save
    new_file_path = file_path.replace('.md', '_enhanced.md')
    with open(new_file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"Saved enhanced markdown to {new_file_path}")

if __name__ == "__main__":
    # Example usage: Process all .md files in 'docs' folder
    files = glob.glob("docs/*.md")
    for f in files:
        process_markdown_file(f)
