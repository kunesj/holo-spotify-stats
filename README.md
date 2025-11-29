# Hololive Spotify Stats

Tool for collecting Hololive stats from Spotify and displaying them in a simple graph.

Website: https://holo-spotify-stats.jirikunes.eu/


## Script Setup

- Use `uv` with Python 3.11+
- Install script dependencies with `uv sync --locked`
- Configure git, ssh and [dma](https://github.com/corecode/dma)
- Create `config.json` from `config.default.json`
- Run with `uv run python cron.py`


### Docker

Alternatively, you can also run the script from docker.

- Configure git, ssh and [dma](https://github.com/corecode/dma) on host
- Create `config.json` from `config.default.json`
- Run `docker compose up -d` to start the container


## Website Setup

### Install Node.js

```bash
nvm install 16.20
nvm use 16.20
```

If you are running this with Pycharm, the NVM ENV variables must be copied from `~/.bashrc` to `~/.profile`. These ones:

```
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
```

### Build assets

```bash
cd website
npm install
npm run build
```

### Run local server

```bash
cd website
npm run preview
```


## Development

Use pre-commit
```bash
pre-commit install
```
