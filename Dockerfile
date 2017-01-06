FROM node:6.6.0
MAINTAINER Gavin Mogan <gavin@saucelabs.com>
EXPOSE 3000
ENV NODE_ENV=production
ENV AC_LOCAL_BASE_URL=https://hipchat-dance-party.saucelabs.com
# UGH - okay fine
# Fix bug https://github.com/npm/npm/issues/9863 for issues with docker + npm
RUN cd $(npm root -g)/npm \
  && npm install fs-extra \
  && sed -i -e s/graceful-fs/fs-extra/ -e s/fs\.rename/fs.move/ ./lib/utils/rename.js

ADD package.json /tmp/package.json
RUN cd /tmp && npm install
RUN mkdir -p /usr/src/app && cp -a /tmp/node_modules /usr/src/app

WORKDIR /usr/src/app
COPY .babelrc .eslintrc *.js atlassian-connect.json config.json package.json /usr/src/app/
COPY lib/ /usr/src/app/lib/
COPY public/ /usr/src/app/public/
COPY routes/ /usr/src/app/routes/
COPY views/ /usr/src/app/views/
RUN npm install --only=dev && $(npm bin)/webpack --config=webpack.config.js -p
#RUN npm test
RUN npm prune --production
RUN rm .babelrc
CMD npm run start

