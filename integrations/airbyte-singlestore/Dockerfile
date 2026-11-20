FROM node:24-alpine
WORKDIR /airbyte
COPY connector.mjs /airbyte/connector.mjs
ENV AIRBYTE_ENTRYPOINT="node /airbyte/connector.mjs"
ENV AIRBYTE_CONNECTOR_IMAGE="substation/airbyte-singlestore:0.1.0"
LABEL io.airbyte.name="substation/airbyte-singlestore" io.airbyte.version="0.1.0"
ENTRYPOINT ["node","/airbyte/connector.mjs"]
