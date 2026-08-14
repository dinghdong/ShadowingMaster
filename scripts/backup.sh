#!/usr/bin/env bash
set -euo pipefail

# ShadowingMaster —— 夜间备份 app.db → 阿里云 OSS（私有桶）
# 复用 backend 镜像内已有的 oss2，不引入新依赖；用 sqlite3.online backup 避免拷到半截的库。
# 由 bootstrap 安装的 cron 每日调用；也可手动：/opt/shadowingmaster/backup.sh

INSTALL_DIR=/opt/shadowingmaster
cd "$INSTALL_DIR"

docker compose run --rm backend python - <<'PY'
import os, datetime, sqlite3, oss2

src = "/data/app.db"
bak = "/tmp/app.db.bak"

# 在线备份：对运行中的库做一致快照，规避直接拷文件的中断风险
conn = sqlite3.connect(src)
dst = sqlite3.connect(bak)
try:
    conn.backup(dst)
finally:
    dst.close()
    conn.close()

ep = os.environ["OSS_ENDPOINT"]
ak = os.environ["OSS_ACCESS_KEY_ID"]
sk = os.environ["OSS_ACCESS_KEY_SECRET"]
b = os.environ["OSS_BUCKET"]
auth = oss2.Auth(ak, sk)
bucket = oss2.Bucket(auth, f"https://{ep}", b)

ts = datetime.datetime.utcnow().strftime("%Y%m%d-%H%M%S")
key = f"backups/app.db.{ts}"
bucket.put_object_from_file(key, bak)
print("uploaded", key)

# 仅保留最近 7 天
cut = (datetime.datetime.utcnow() - datetime.timedelta(days=7)).timestamp()
for o in bucket.list_objects(prefix="backups/").object_list:
    if o.last_modified < cut:
        bucket.delete_object(o.key)
        print("pruned", o.key)
PY
