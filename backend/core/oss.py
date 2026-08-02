"""阿里云 OSS 接入（可选，环境驱动）。

仅当下列环境变量齐备时才启用；缺任一则自动降级为「本地磁盘」模式，
保持开发环境零配置可用。

必须变量：
  OSS_ENDPOINT          例如 oss-eu-west-1.aliyuncs.com（海外桶免备案）
  OSS_BUCKET            桶名
  OSS_ACCESS_KEY_ID
  OSS_ACCESS_KEY_SECRET

可选：
  OSS_REGION            eu-west-1（仅日志/兼容用，可不设）
  OSS_URL_EXPIRE        签名 URL 有效期（秒），默认 3600

约定：DB 中 video_path / thumbnail_url 仍存相对路径（如 /media/abc.mp4）；
本模块按「相对路径去掉前导斜杠即 OSS object key」规则映射，
前端拿到的是可直接 <video src> 的（带签名的）绝对 OSS URL。
桶保持私有，对外一律走签名 URL，避免公开读权限。
"""
import os

try:
    import oss2
except ImportError:  # 本地未装 oss2 时不影响 API 启动，OSS 自动禁用
    oss2 = None

OSS_ENDPOINT = os.environ.get("OSS_ENDPOINT", "").strip().rstrip("/")
OSS_BUCKET = os.environ.get("OSS_BUCKET", "").strip()
OSS_ACCESS_KEY_ID = os.environ.get("OSS_ACCESS_KEY_ID", "").strip()
OSS_ACCESS_KEY_SECRET = os.environ.get("OSS_ACCESS_KEY_SECRET", "").strip()
OSS_REGION = os.environ.get("OSS_REGION", "").strip()
try:
    OSS_URL_EXPIRE = int(os.environ.get("OSS_URL_EXPIRE", "3600"))
except ValueError:
    OSS_URL_EXPIRE = 3600

OSS_ENABLED = bool(
    oss2 and OSS_ENDPOINT and OSS_BUCKET and OSS_ACCESS_KEY_ID and OSS_ACCESS_KEY_SECRET
)

_bucket = None


def _normalize_endpoint(ep: str) -> str:
    if ep.startswith("https://"):
        return ep[len("https://"):]
    if ep.startswith("http://"):
        return ep[len("http://"):]
    return ep


def _bucket_client():
    global _bucket
    if _bucket is None:
        auth = oss2.Auth(OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET)
        # 强制 https：前端是 https 页面，若返回 http 媒体 URL 会被浏览器当作
        # mixed content 拦截（<video>/<img> 加载失败）。
        endpoint = "https://" + _normalize_endpoint(OSS_ENDPOINT)
        _bucket = oss2.Bucket(auth, endpoint, OSS_BUCKET)
    return _bucket


def key_for(rel_path: str) -> str:
    """相对路径 -> OSS object key（去掉前导斜杠，统一为正斜杠）。"""
    return rel_path.lstrip("/").replace("\\", "/")


def signed_url(rel_path: str, expire: int = None) -> str:
    """生成带签名的临时访问 URL（桶为私有时使用）。"""
    if expire is None:
        expire = OSS_URL_EXPIRE
    b = _bucket_client()
    return b.sign_url("GET", key_for(rel_path), expire)


def upload_file(rel_path: str, local_path: str) -> str:
    """上传本地文件到 OSS，返回签名访问 URL。失败直接抛异常（由调用方决定如何处理）。"""
    b = _bucket_client()
    b.put_object_from_file(key_for(rel_path), local_path)
    return signed_url(rel_path)


def get_serve_url(rel_path):
    """解析给前端的媒体 URL：OSS 启用 -> 带签名的绝对 URL；否则原样返回相对路径。"""
    if not rel_path:
        return rel_path
    if str(rel_path).startswith(("http://", "https://")):
        return rel_path
    if OSS_ENABLED:
        return signed_url(rel_path)
    return rel_path
