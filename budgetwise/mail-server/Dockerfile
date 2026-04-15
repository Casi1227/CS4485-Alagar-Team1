FROM node:20-alpine

RUN apk add -u postfix

COPY main.cf master.cf /etc/postfix/

RUN postalias /etc/postfix/aliases

EXPOSE 25 465 587

CMD ["postfix", "start-fg"]
