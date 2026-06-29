# Production stage using pre-built files
FROM nginx:alpine

# Copy custom nginx config with SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build files directly
COPY dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
