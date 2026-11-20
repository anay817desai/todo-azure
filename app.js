const API_URL = "/api";

// On page load: ask Azure who is signed in
window.onload = async function () {
  let user = null;
  try {
    const res = await fetch("/.auth/me");
    user = (await res.json()).clientPrincipal; // null when signed out
  } catch (err) {
    console.error("Could not check sign-in status:", err);
  }

  if (!user) {
    document.getElementById("loginScreen").hidden = false;
    return;
  }

  document.getElementById("userName").textContent = user.userDetails;
  document.getElementById("appScreen").hidden = false;
  loadTodos();
};

async function loadTodos() {
  try {
    const res = await fetch(`${API_URL}/todos`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderTodos(await res.json());
  } catch (err) {
    console.error("Could not load to-dos:", err);
  }
}

async function addTodo() {
  const input = document.getElementById("todoInput");
  const text = input.value.trim();
  if (!text) return;

  await fetch(`${API_URL}/todos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });

  input.value = "";
  loadTodos();
}

async function toggleDone(id, done) {
  await fetch(`${API_URL}/todos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ done: !done })
  });
  loadTodos();
}

async function deleteTodo(id) {
  await fetch(`${API_URL}/todos/${id}`, { method: "DELETE" });
  loadTodos();
}

function renderTodos(todos) {
  const list = document.getElementById("todoList");
  list.replaceChildren();

  if (todos.length === 0) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "No to-dos yet. Add one above!";
    list.appendChild(p);
    return;
  }

  todos.forEach(todo => {
    const li = document.createElement("li");
    if (todo.done) li.className = "done";

    const span = document.createElement("span");
    span.textContent = todo.text;

    const actions = document.createElement("div");
    actions.className = "todo-actions";

    const doneBtn = document.createElement("button");
    doneBtn.className = "btn-done";
    doneBtn.textContent = todo.done ? "Undo" : "Done";
    doneBtn.onclick = () => toggleDone(todo.id, todo.done);

    const delBtn = document.createElement("button");
    delBtn.className = "btn-delete";
    delBtn.textContent = "Delete";
    delBtn.onclick = () => deleteTodo(todo.id);

    actions.append(doneBtn, delBtn);
    li.append(span, actions);
    list.appendChild(li);
  });
}
