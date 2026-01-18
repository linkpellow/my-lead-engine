"""
2026 Dynamic VRAM Orchestration (Sovereign Guard).

Fractional allocation and KV-cache hints so DeepSeek-VL2 + olmOCR-2 run
on a single 24GB GPU (e.g. RTX 4090/5090) with ~7GB headroom.

- DeepSeek-VL2 (Speed): gpu_memory_utilization=0.3 (~3.5GB weights + ~1.5GB KV)
- olmOCR-2 (Accuracy): gpu_memory_utilization=0.5 (~8.1GB Q8_0 + ~4GB KV)
- Hot-Swap: prepare_for_olmocr() after offloading DeepSeek (caller must unload)
- KV Cache: recommend INT8 where supported (vLLM/llama.cpp); no-op for plain PyTorch.
"""

import logging
import os

logger = logging.getLogger(__name__)

DEEPSEEK_FRACTION = float(os.getenv("VRAM_DEEPSEEK_FRACTION", "0.3"))
OLMOCR_FRACTION = float(os.getenv("VRAM_OLMOCR_FRACTION", "0.5"))


def set_fraction_for_speed_tier() -> None:
    """Before loading DeepSeek-VL2: cap GPU usage to ~30% (~7GB on 24GB)."""
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.set_per_process_memory_fraction(DEEPSEEK_FRACTION)
            logger.info("VRAM: set_per_process_memory_fraction(%.2f) for DeepSeek (speed tier)", DEEPSEEK_FRACTION)
    except Exception as e:
        logger.debug("VRAM set_fraction speed: %s", e)


def set_fraction_for_accuracy_tier() -> None:
    """Before loading olmOCR-2: cap to ~50% (~12GB on 24GB)."""
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.set_per_process_memory_fraction(OLMOCR_FRACTION)
            logger.info("VRAM: set_per_process_memory_fraction(%.2f) for olmOCR (accuracy tier)", OLMOCR_FRACTION)
    except Exception as e:
        logger.debug("VRAM set_fraction accuracy: %s", e)


def prepare_for_olmocr() -> None:
    """
    Handover: after offloading DeepSeek (caller must set model to None/del),
    clear caches and set fraction for olmOCR. Reduces OOM when loading olmOCR
    while DeepSeek was previously loaded.
    """
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.set_per_process_memory_fraction(OLMOCR_FRACTION)
            logger.info("VRAM: prepare_for_olmocr (empty_cache + fraction %.2f)", OLMOCR_FRACTION)
    except Exception as e:
        logger.debug("VRAM prepare_for_olmocr: %s", e)


def recommend_kv_cache_quantization() -> None:
    """
    KV Cache INT8: reduces memory growth on long-context people-search pages.
    In 2026, vLLM (PagedAttention) or llama.cpp GGUF offload handle this natively.
    For plain PyTorch/transformers this is a no-op; log a hint.
    """
    if os.getenv("VRAM_KV_INT8", "").lower() in ("1", "true", "yes"):
        logger.info("VRAM: KV INT8 requested; use vLLM or llama.cpp for native support. Plain PyTorch: no-op.")
    # Optional: torch.compile or backend settings if supported in the environment
    try:
        import torch
        if hasattr(torch, "backends") and hasattr(torch.backends, "cuda") and hasattr(torch.backends.cuda, "matmul"):
            # Allow TF32 on Ampere+ as a trade-off; INT8 KV would need model-level support
            pass
    except Exception:
        pass
