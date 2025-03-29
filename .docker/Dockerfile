FROM python:3.11-slim-bullseye

ENV LANGUAGE=en_US.UTF-8
ENV PGCLIENTENCODING utf8
ENV PYTHONIOENCODING utf8
ENV DEBIAN_FRONTEND noninteractive

ARG DOCKER_SRC=/opt/holo-spotify-stats

# init path where the code and data will be mounted

RUN mkdir -p ${DOCKER_SRC}/

# install apt requirements

COPY .docker/pkglist /tmp/pkglist
RUN set -x; apt-get update -y && apt-get install -f -y --no-install-recommends $(cat /tmp/pkglist) && apt-get clean

# install pip requirements

COPY /requirements.txt /tmp/requirements.txt
RUN pip3 install dbus-python && pip3 install --upgrade -r /tmp/requirements.txt

# copy launch script to /

COPY .docker/launch.sh /
RUN chmod 700 /launch.sh

# finish

USER root
CMD [ "sleep", "999999" ]
