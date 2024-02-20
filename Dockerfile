# Use the official Node.js image as a base
FROM node:latest

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# # Install MySQL client
# RUN apt-get update && apt-get install -y mysql-client

# Copy all files to the working directory
COPY . .

# Expose port 8080
EXPOSE 8080
# Command to run your server
CMD ["npm", "start"]

