const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");
const { randomUUID } = require("crypto");

const USER_ID = "user-1"; // fixed user, same as the AWS version

let container;
function getContainer() {
  if (!container) {
    container = new CosmosClient(process.env.COSMOS_CONNECTION_STRING)
      .database("todoapp")
      .container("Todos");
  }
  return container;
}

// GET /api/todos   and   POST /api/todos
app.http("todos", {
  route: "todos",
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const c = getContainer();

      if (request.method === "GET") {
        const { resources } = await c.items
          .query({
            query: "SELECT * FROM c WHERE c.userId = @u ORDER BY c.createdAt",
            parameters: [{ name: "@u", value: USER_ID }]
          })
          .fetchAll();
        return { jsonBody: resources };
      }

      const body = await request.json();
      const text = (body.text || "").trim();
      if (!text) return { status: 400, jsonBody: { error: "text is required" } };

      const todo = {
        id: randomUUID(),
        userId: USER_ID,
        text,
        done: false,
        createdAt: new Date().toISOString()
      };
      await c.items.create(todo);
      return { status: 201, jsonBody: todo };
    } catch (err) {
      context.error(err);
      return { status: 500, jsonBody: { error: "Server error" } };
    }
  }
});

// PATCH /api/todos/{id}   and   DELETE /api/todos/{id}
app.http("todoItem", {
  route: "todos/{id}",
  methods: ["PATCH", "DELETE"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const item = getContainer().item(request.params.id, USER_ID);

      if (request.method === "DELETE") {
        await item.delete();
        return { jsonBody: { message: "Deleted" } };
      }

      const { resource } = await item.read();
      if (!resource) return { status: 404, jsonBody: { error: "Not found" } };

      const body = await request.json();
      resource.done = Boolean(body.done);
      await item.replace(resource);
      return { jsonBody: resource };
    } catch (err) {
      if (err.code === 404) return { status: 404, jsonBody: { error: "Not found" } };
      context.error(err);
      return { status: 500, jsonBody: { error: "Server error" } };
    }
  }
});
