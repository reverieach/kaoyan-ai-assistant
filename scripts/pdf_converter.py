import sys
import os
import re
import json
import time
import logging
import base64
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', stream=sys.stderr)
logger = logging.getLogger(__name__)

# Import dependencies
try:
    import pymupdf4llm
except ImportError:
    print(json.dumps({"error": "Missing dependency: pymupdf4llm"}), file=sys.stdout)
    sys.exit(1)

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

# Optional: Embedding Dependency
try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    HAS_EMBEDDING = True
except Exception as e:
    HAS_EMBEDDING = False
    logger.warning(f"sentence-transformers/torch failed to load ({str(e)}). Skipping embedding generation.")

# --- Configuration ---
# You can set these via environment variables or hardcode them
API_KEY = os.getenv("API_KEY", "sk-806ab12202614838843940c6c750b31e") # Default or Env
BASE_URL = os.getenv("BASE_URL", "https://api.deepseek.com")
MODEL_NAME = os.getenv("MODEL_NAME", "deepseek-coder") # deepseek-coder by default

# --- Configuration ---
# You can set these via environment variables or hardcode them
API_KEY = os.getenv("API_KEY", "sk-806ab12202614838843940c6c750b31e") # Default or Env
BASE_URL = os.getenv("BASE_URL", "https://api.deepseek.com")
MODEL_NAME = os.getenv("MODEL_NAME", "deepseek-coder") # deepseek-coder by default

class SuppressStdout:
    def __enter__(self):
        self._original_stdout = sys.stdout
        sys.stdout = open(os.devnull, 'w')
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        sys.stdout.close()
        sys.stdout = self._original_stdout

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def describe_image_vlm(client, image_path, model_name):
    """
    Calls VLM to describe the image using the specialized prompt.
    Includes simple retry mechanism.
    """
    system_prompt = (
        "你是计算机考研助教。请针对“11408计算机/数学考研”优化图片描述，用于RAG检索。"
        "如果是数学图：描述函数走势、几何关系。"
        "如果是数据结构/算法图：描述结构特征、节点关系、操作步骤。"
        "如果是计组/OS/网络图：描述组件名称、数据流向、协议层级。"
        "保持简练，不要废话。"
    )
    
    encoded_img = encode_image(image_path)
    
    retries = 3
    for attempt in range(retries):
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": system_prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{encoded_img}"
                                },
                            },
                        ],
                    }
                ],
                max_tokens=500,
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.warning(f"Attempt {attempt+1}/{retries} failed for {os.path.basename(image_path)}: {e}")
            time.sleep(1 * (attempt + 1))
    
    return "图片描述生成失败 (Max retries exceeded)"

def process_single_image_task(img_info, client, model_name):
    """
    Worker function for ThreadPoolExecutor.
    """
    desc = describe_image_vlm(client, img_info['absolute_path'], model_name)
    return {
        "relative_path": img_info['relative_path'],
        "description": desc
    }

def chunk_markdown(md_text, source_filename):
    """
    Splits markdown by headers (H1, H2, H3) to create semantic chunks.
    Heuristic:
    - Split by #, ##, ###
    - If chunk is too large (> 1000 chars), split by paragraphs.
    - If chunk is too small (< 50 chars), merge with next.
    """
    # Simple regex split for MVP.
    # Captures header level and title
    # Pattern: (^#{1,3}\s+.*$) multiline
    
    chunks = []
    lines = md_text.split('\n')
    
    current_chunk = {
        "content": "",
        "metadata": {"source": source_filename, "chapter": "Introduction"}
    }
    
    current_header = "Start"
    
    for line in lines:
        header_match = re.match(r'^(#{1,3})\s+(.*)', line)
        if header_match:
            # Save previous chunk if meaningful
            if len(current_chunk["content"].strip()) > 50:
                chunks.append(current_chunk)
            
            # Start new chunk
            current_header = header_match.group(2).strip()
            current_chunk = {
                "content": line + "\n",
                "metadata": {"source": source_filename, "chapter": current_header}
            }
        else:
            current_chunk["content"] += line + "\n"
            
    # Last chunk
    if len(current_chunk["content"].strip()) > 20:
        chunks.append(current_chunk)
        
    return chunks

def generate_embeddings(chunks, model_name='all-MiniLM-L6-v2'):
    """
    Generates embeddings for a list of chunk texts.
    Returns list of embeddings (list of floats).
    """
    if not HAS_EMBEDDING:
        return []
        
    logger.info("Loading Embedding Model...")
    model = SentenceTransformer(model_name)
    
    texts = [c['content'] for c in chunks]
    logger.info(f"Generating embeddings for {len(texts)} chunks...")
    embeddings = model.encode(texts)
    
    # Inject embeddings back into chunks
    for i, chunk in enumerate(chunks):
        chunk['embedding'] = embeddings[i].tolist() # Convert numpy to list for JSON serialization
        
    return chunks


def process_zip_archive(zip_path, output_dir):
    """
    Extracts zip, finds MD file, and enhances it.
    """
    import shutil
    
    extract_dir = os.path.join(output_dir, "extracted")
    shutil.unpack_archive(zip_path, extract_dir)
    
    # Find .md file
    md_files = []
    for root, _, files in os.walk(extract_dir):
        for f in files:
            if f.lower().endswith('.md') and not f.lower().endswith('_enhanced.md'):
                md_files.append(os.path.join(root, f))
    
    if not md_files:
        raise ValueError("No Markdown file found in the archive")
    
    # Pick the largest MD file (likely the main content) or the first one
    # Heuristic: Main content is usually the largest
    target_md = max(md_files, key=lambda p: os.path.getsize(p))
    logger.info(f"Processing Markdown file: {target_md}")
    
    with open(target_md, 'r', encoding='utf-8') as f:
        md_text = f.read()

    # Identify images in MD
    # Regex for ![alt](path)
    image_links = re.findall(r'!\[.*?\]\((.*?)\)', md_text)
    
    # De-duplicate
    unique_links = set(image_links)
    valid_images = []
    
    md_dir = os.path.dirname(target_md)
    
    # Function to download remote image
    def download_remote_image(url, save_dir):
        try:
            import urllib.request
            fname = os.path.basename(url.split('?')[0]) # simple name extraction
            if not fname or len(fname) > 255: fname = "downloaded_img"
            # Ensure extension
            if not os.path.splitext(fname)[1]: fname += ".png"
            
            save_path = os.path.join(save_dir, f"remote_{int(time.time())}_{fname}")
            
            # Simple download (add headers if needed for some CDNs)
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response, open(save_path, 'wb') as out_file:
                out_file.write(response.read())
            return save_path
        except Exception as e:
            logger.warning(f"Failed to download {url}: {e}")
            return None

    for rel_path in unique_links:
        # Check for Remote URL
        if rel_path.startswith(('http://', 'https://')):
            # It's a network image
            dl_dir = os.path.join(output_dir, "downloaded_images")
            os.makedirs(dl_dir, exist_ok=True)
            t_path = download_remote_image(rel_path, dl_dir)
            if t_path:
                valid_images.append({
                    "absolute_path": t_path,
                    "relative_path": rel_path # We want to replace this URL later
                })
        else:
            # Local file logic
            abs_path = os.path.join(md_dir, rel_path)
            if os.path.exists(abs_path):
                valid_images.append({
                    "absolute_path": abs_path,
                    "relative_path": rel_path
                })
            else:
                logger.warning(f"Image not found: {abs_path}")

    return md_text, valid_images

def convert_and_enhance(input_path, output_dir):
    ext = os.path.splitext(input_path)[1].lower()
    
    md_text = ""
    image_files = [] # list of {absolute_path, relative_path}

    if ext == '.zip':
        logger.info(f"Processing Zip Archive: {input_path}")
        md_text, image_files = process_zip_archive(input_path, output_dir)
        
    elif ext == '.pdf':
        # Fallback to Phase 1 (Pymupdf4llm)
        logger.info(f"Phase 1: Converting PDF {input_path}...")
        image_out_path = os.path.join(output_dir, "images")
        os.makedirs(image_out_path, exist_ok=True)
        
        if 'pymupdf4llm' in sys.modules:
             md_text = pymupdf4llm.to_markdown(
                input_path, 
                write_images=True, 
                image_path=image_out_path,
                image_format="png"
            )
             # Crawl for images as before
             for root, _, files in os.walk(image_out_path):
                for file in files:
                    if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                        image_files.append({
                            "absolute_path": os.path.join(root, file),
                            "relative_path": f"images/{file}" # Approximation
                        })
        else:
             raise ImportError("pymupdf4llm not installed")

    elif ext == '.md':
        logger.info(f"Processing Markdown File: {input_path}")
        with open(input_path, 'r', encoding='utf-8') as f:
            md_text = f.read()
            
        # Try to find images
        image_links = re.findall(r'!\[.*?\]\((.*?)\)', md_text)
        md_dir = os.path.dirname(input_path)
        
        # Helper for download (duplicate code, improved if refactored but inline is fine for now)
        def download_remote_image_md(url, save_dir):
            try:
                import urllib.request
                fname = os.path.basename(url.split('?')[0])
                if not fname: fname = "dl_img"
                save_path = os.path.join(save_dir, f"remote_{int(time.time())}_{fname}")
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response, open(save_path, 'wb') as out_file:
                    out_file.write(response.read())
                return save_path
            except Exception as e:
                logger.warning(f"Download fail: {e}")
                return None

        for rel_path in set(image_links):
            if rel_path.startswith(('http://', 'https://')):
                 dl_dir = os.path.join(output_dir, "downloaded_images")
                 os.makedirs(dl_dir, exist_ok=True)
                 t_path = download_remote_image_md(rel_path, dl_dir)
                 if t_path:
                     image_files.append({
                        "absolute_path": t_path,
                        "relative_path": rel_path
                    })
            else:
                abs_path = os.path.join(md_dir, rel_path)
                if os.path.exists(abs_path) and os.path.isfile(abs_path):
                     image_files.append({
                        "absolute_path": abs_path,
                        "relative_path": rel_path
                    })
    
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    logger.info(f"Found {len(image_files)} images. Phase 2: Visual Semantic Enhancement...")

    # 2. Phase 2: Enhanced Description with Concurrency
    if not OpenAI:
        logger.error("OpenAI SDK not found. Skipping VLM enhancement.")
        return {"content": md_text, "images": image_files}

    client = OpenAI(api_key=API_KEY, base_url=BASE_URL)
    
    # Map descriptions
    description_map = {}
    
    with ThreadPoolExecutor(max_workers=4) as executor:
        future_to_img = {
            executor.submit(process_single_image_task, img, client, MODEL_NAME): img 
            for img in image_files
        }
        
        completed = 0
        total = len(image_files)
        
        for future in as_completed(future_to_img):
            completed += 1
            if completed % 1 == 0 or completed == total:
                # Use a specific prefix to distinguish progress from other logs
                progress_data = json.dumps({
                    "progress": int((completed / total) * 100),
                    "message": f"正在解析图片 ({completed}/{total})..."
                }, ensure_ascii=False)
                # FIX: Write to the formatted Original Stdout if suppressed, or sys.stdout otherwise.
                # Since SuppressStdout is active, sys.stdout is devnull. We need to access the real one.
                # We can't easily pass it down without refactoring.
                # ALTERNATIVE: Write progress to stderr. Node.js can parse stderr too? 
                # Better: In SuppressStdout, we can monkeypatch or just use sys.__stdout__ which usually remains attached.
                print(f"PROGRESS:{progress_data}", file=sys.__stdout__, flush=True)  # Use sys.__stdout__ to bypass redirection
                logger.info(f"Progress: {completed}/{total} images processed")
                
            try:
                res = future.result()
                description_map[res['relative_path']] = res['description']
            except Exception as exc:
                logger.error(f"Image processing exception: {exc}")

    # 3. Injection
    logger.info("Injecting descriptions into Markdown...")
    final_md = md_text
    
    for img in image_files:
        rel_path = img['relative_path']
        desc = description_map.get(rel_path)
        
        if desc:
            # Safer replace logic
            target = f"({rel_path})"
            replacement = f"({rel_path})\n\n> **[AI图解]** {desc}\n\n"
            final_md = final_md.replace(target, replacement)

    # 4. Save Enhanced Copy (Optional, strictly for debug or local usage)
    # The API cares about the returned JSON content.
    enhanced_file = os.path.join(output_dir, "_enhanced.md")
    with open(enhanced_file, "w", encoding="utf-8") as f:
        f.write(final_md)

    # 5. [NEW] Chunking & Embedding
    logger.info("Phase 3: Chunking & Embedding...")
    chunks = chunk_markdown(final_md, os.path.basename(input_path))
    if HAS_EMBEDDING:
        chunks = generate_embeddings(chunks)
    else:
        logger.warning("Skipping vectorization (module missing). Chunks will be text-only.")

    return {
        "content": final_md,
        "images": image_files,
        "chunks": chunks 
    }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python pdf_converter.py <pdf_path> <output_dir>"}), file=sys.stdout)
        sys.exit(1)

    pdf_file = sys.argv[1]
    out_dir = sys.argv[2]

    try:
        # Suppress pymupdf/other stdout noise so we print clean JSON at the end
        with SuppressStdout():
            result = convert_and_enhance(pdf_file, out_dir)
            
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        logger.exception("Fatal error in script")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
