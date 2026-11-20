const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");
const { randomUUID } = require("crypto");

let container;
function getContainer() {
  if (!container) {
    container = new CosmosClient(process.env.COSMOS_CONNECTION_STRING)
      .database("todoapp")
      .container("Todos");
  }
  return container;
}

// Static Web Apps adds this header to every request from a signed-in user
function getUserId(request) {
  const header = request.headers.get("x-ms-client-principal");
  if (!header) return null;
  const principal = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  return principal.userId || null;
}

// GET /api/todos   and   POST /api/todos
app.http("todos", {
  route: "todos",
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    const userId = getUserId(request);
    if (!userId) return { status: 401, jsonBody: { error: "Not signed in" } };

    try {
      const c = getContainer();

      if (request.method === "GET") {
        const { resources } = await c.items
          .query({
            query: "SELECT * FROM c WHERE c.userId = @u ORDER BY c.createdAt",
            parameters: [{ name: "@u", value: userId }]
          })
          .fetchAll();
        return { jsonBody: resources };
      }

      const body = await request.json();
      const text = (body.text || "").trim();
      if (!text) return { status: 400, jsonBody: { error: "text is required" } };

      const todo = {
        id: randomUUID(),
        userId,
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
    const userId = getUserId(request);
    if (!userId) return { status: 401, jsonBody: { error: "Not signed in" } };

    try {
      // The partition key is this user's ID, so one user can never touch another's items
      const item = getContainer().item(request.params.id, userId);

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
