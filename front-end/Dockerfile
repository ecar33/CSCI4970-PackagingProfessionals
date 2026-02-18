# Base image node
FROM node:14
# set working directory
WORKDIR /app
# copy package info
COPY package*.json ./
#install npm
RUN npm install
# copy all files to working directory
COPY . .
# build the app
RUN npm run build
# serve the app
RUN npm install -g serve
# expose port 3000
EXPOSE 3000
# serve the app
CMD ["serve", "-s", "build"]