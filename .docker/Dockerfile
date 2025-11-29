FROM python:3.11-slim-bullseye

ENV LANGUAGE=en_US.UTF-8
ENV PGCLIENTENCODING=utf8
ENV PYTHONIOENCODING=utf8
ENV DEBIAN_FRONTEND=noninteractive

# init home directory of non-root user where everything will be mounted

RUN mkdir -p /home/host/

# install uv

COPY --from=ghcr.io/astral-sh/uv:0.9.13 /uv /uvx /bin/
RUN echo 'eval "$(uv generate-shell-completion bash)"' >> ~/.bashrc
RUN echo 'eval "$(uvx --generate-shell-completion bash)"' >> ~/.bashrc

ENV UV_SYSTEM_PYTHON=1

# install apt requirements
# - cache is configured to be reusable

COPY .docker/pkglist /tmp/pkglist
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,target=/var/lib/apt,sharing=locked \
  apt update -y && apt-get install -f -y --no-install-recommends $(cat /tmp/pkglist)

# install python dependencies and copy the code
# - uv will use the same cache across builds: https://docs.astral.sh/uv/guides/integration/docker/#intermediate-layers

ENV UV_LINK_MODE=copy
ENV UV_PYTHON_CACHE_DIR=/root/.cache/uv/python

RUN --mount=type=cache,target=/root/.cache/uv,sharing=locked \
  --mount=type=bind,source=uv.lock,target=uv.lock \
  --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
  uv sync --locked --no-install-project -v

# install playwright dependencies
# - uses apt, so we must mount apt cache

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,target=/var/lib/apt,sharing=locked \
  uv run playwright install-deps

# copy launch script to /

COPY .docker/launch.sh /
RUN chmod 700 /launch.sh

# finish

USER root
CMD [ "sleep", "999999" ]
