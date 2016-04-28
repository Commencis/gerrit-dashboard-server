FROM node:4.4
LABEL type="node" purpose="api" role="core" description="Gerrit Dashboard Server"
ENV NODE_ENV production
ENV SOURCE_TYPE DB
ENV GERRIT_DASHBOARD_CONFIG_PATH /opt/config
COPY dist /srv/app
WORKDIR /srv/app
EXPOSE 3000
VOLUME ["/opt/config"]
CMD ["./bin/www"]
