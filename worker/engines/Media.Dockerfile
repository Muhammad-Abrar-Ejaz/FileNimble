FROM python:3.12-slim@sha256:2f17fc044b579bab302c2e8054d3a686e2cb9a83de48e70534b94cd8ebbe06a9 AS build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential pkg-config nasm curl ca-certificates xz-utils libvpx-dev zlib1g-dev
WORKDIR /build
COPY --from=ffmpeg-source ffmpeg-8.1.3.tar.xz /build/ffmpeg.tar.xz
RUN echo "7138d28c96d9d3e3af4ee3d8cad72741f8ffb40da90c1112235dea3ecd3178a3  /build/ffmpeg.tar.xz" | sha256sum -c -
RUN tar -xf ffmpeg.tar.xz
WORKDIR /build/ffmpeg-8.1.3
RUN ./configure --prefix=/usr/local --disable-autodetect --disable-gpl --disable-nonfree --disable-version3 --disable-doc --disable-debug --disable-everything --enable-ffmpeg --enable-ffprobe --enable-avfilter --enable-swresample --enable-swscale --enable-libvpx --enable-zlib --enable-protocol=file,pipe --enable-demuxer=wav,flac,matroska --enable-muxer=wav,flac,webm,null,image2 --enable-decoder=pcm_s16le,pcm_f32le,flac,vp8,vorbis,wrapped_avframe --enable-encoder=pcm_s16le,flac,png,wrapped_avframe,libvpx_vp8,vorbis --enable-parser=flac,vp8,vorbis --enable-filter=aresample,anull,null,format,scale,color,sine,testsrc2 --enable-indev=lavfi && make -j2 && make install
RUN mkdir -p /usr/local/share/filenimble-licenses && cp COPYING.LGPLv2.1 LICENSE.md /usr/local/share/filenimble-licenses/ && cp /build/ffmpeg.tar.xz /usr/local/share/filenimble-licenses/ffmpeg-8.1.3.tar.xz && cp ffbuild/config.log /usr/local/share/filenimble-licenses/build-config.log && cp /usr/share/doc/libvpx-dev/copyright /usr/local/share/filenimble-licenses/libvpx-copyright && dpkg-query -W libvpx-dev zlib1g > /usr/local/share/filenimble-licenses/system-versions.txt && /usr/local/bin/ffmpeg -L 2>&1 | grep 'Lesser General Public License'

FROM python:3.12-slim@sha256:2f17fc044b579bab302c2e8054d3a686e2cb9a83de48e70534b94cd8ebbe06a9
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOME=/work TMPDIR=/work
COPY --from=build /usr/local/bin/ffmpeg /usr/local/bin/ffprobe /usr/local/bin/
COPY --from=build /usr/lib/x86_64-linux-gnu/libvpx.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/local/share/filenimble-licenses /usr/local/share/filenimble-licenses
RUN useradd --uid 10001 --no-create-home converter
WORKDIR /engine
COPY worker/phase11_policy.py worker/engines/media.py worker/engines/phase11_runner.py /engine/
USER 10001:10001
ENTRYPOINT ["python", "/engine/phase11_runner.py"]
