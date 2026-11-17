
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const path = require("path");

const options = {
  definition: {
    openapi: "3.0.0",

    info: {
      title: "Ticket Management API",
      version: "1.0.0",
      description: "API documentation for Ticket Management System",
    },

    servers: [
      {
        url: "http://localhost:5000",
        description: "Development server",
      },
    ],

    components: {
      schemas: {
        Admin: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: {
              type: "string",
              example: "Admin User",
            },
            email: {
              type: "string",
              example: "admin@example.com",
            },
            password: {
              type: "string",
              example: "Admin@123",
            },
          },
        },
      },
    },
  },

  apis: [
    path.join(__dirname, "routes", "*.ts").replace(/\\/g, "/"),
    path.join(__dirname, "routes", "*.js").replace(/\\/g, "/"),
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  swaggerSpec,
};
