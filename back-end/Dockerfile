# Import base image of python3
FROM python:3 
# Set working directory
WORKDIR /app
# Set environment variable
ENV FLASK_APP=app.py
# Copy all files to container
COPY . .
# Run installations from requirements.txt
RUN pip install -r requirements.txt
# Run the app
CMD ["python", "run.py"]
# Expose port 5000
EXPOSE 5000