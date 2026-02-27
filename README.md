# CSCI4970-PackagingProfessionals
An inventory management software for The UPS Store #4166 meant to track sales data and incoming order summaries to provide an accurate overview of current inventory stock and trends.
Currently a basic demo of container communication while we set up actual app functionality.

## Release Notes
- Containerized web app with Flask back-end API and a React front-end
- Front-end reads container health from the back-end as a demonstration of container links
- Successful builds are automatically pushed to Dockerhub through Ray's account (https://hub.docker.com/repositories/raycronin)
- Synology NAS at the UPS Store is able to pull these images remotely to stay up to date with the latest build
- SQL Table for inventory added to back-end but is currently not accessed
