"""Create local Judge0 secrets. Run once on the dedicated judge host."""
from pathlib import Path
import secrets
p = Path(__file__).with_name('judge0.conf')
if p.exists():
    raise SystemExit('judge0.conf already exists; refusing to replace secrets.')
config = {
 'REDIS_HOST':'redis', 'REDIS_PASSWORD':secrets.token_hex(32),
 'POSTGRES_HOST':'db', 'POSTGRES_DB':'judge0','POSTGRES_USER':'judge0',
 'POSTGRES_PASSWORD':secrets.token_hex(32), 'AUTHN_HEADER':'X-Auth-Token',
 'AUTHN_TOKEN':secrets.token_hex(32), 'SECRET_KEY_BASE':secrets.token_hex(64),
 'ENABLE_NETWORK':'false','ALLOW_ENABLE_NETWORK':'false','ENABLE_CALLBACKS':'false',
 'ENABLE_ADDITIONAL_FILES':'false','ENABLE_COMMAND_LINE_ARGUMENTS':'false',
 'ENABLE_COMPILER_OPTIONS':'false','ENABLE_BATCHED_SUBMISSIONS':'true',
 'MAX_SUBMISSION_BATCH_SIZE':'50','MAX_QUEUE_SIZE':'200',
 'CPU_TIME_LIMIT':'2','MAX_CPU_TIME_LIMIT':'10','WALL_TIME_LIMIT':'15',
 'MAX_WALL_TIME_LIMIT':'30','MEMORY_LIMIT':'262144','MAX_MEMORY_LIMIT':'524288',
 'MAX_FILE_SIZE':'64','MAX_MAX_FILE_SIZE':'64','COUNT':'2','RAILS_ENV':'production'
}
with p.open('x') as f:
    p.chmod(0o600)
    f.write('\n'.join(f'{k}={v}' for k,v in config.items())+'\n')
print('Created judge/judge0.conf. Copy AUTHN_TOKEN into the Site secret JUDGE0_AUTH_TOKEN; do not commit this file.')
