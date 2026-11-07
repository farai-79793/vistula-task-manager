class TaskApp {
  constructor() {
    this.editingId = null;
    this.tasks = [];
    this.els = {
      form: document.getElementById('task-form'),
      title: document.getElementById('task-title'),
      desc: document.getElementById('task-description'),
      submit: document.getElementById('task-submit'),
      list: document.getElementById('task-list'),
      msg: document.getElementById('status-message'),
    };
  }

  async start() {
    try {
      const r = await fetch('config.json');
      this.cfg = await r.json();
    } catch { return this.notify('config.json could not be loaded', true); }
    this.els.form.addEventListener('submit', (e) => this.onSubmit(e));
    this.els.list.addEventListener('click', (e) => this.onListClick(e));
    await this.refresh();
  }

  notify(text, error = false) {
    this.els.msg.textContent = text;
    this.els.msg.style.color = error ? '#ff6b6b' : '#6bff9e';
  }

  async request(path, method = 'GET', body) {
    const k = this.cfg.supabasePublishableKey;
    const headers = { apikey: k, 'Content-Type': 'application/json', Prefer: 'return=representation' };
    if (k.startsWith('eyJ')) headers.Authorization = `Bearer ${k}`;
    const res = await fetch(`${this.cfg.supabaseUrl}/rest/v1/${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const txt = await res.text();
    return txt ? JSON.parse(txt) : [];
  }

  async refresh() {
    try {
      this.tasks = await this.request('tasks?select=*&order=id.asc');
      this.draw();
    } catch (err) { this.notify(`Loading failed – ${err.message}`, true); }
  }

  draw() {
    this.els.list.replaceChildren(...this.tasks.map((t) => {
      const item = document.createElement('div');
      item.className = 'task-item' + (t.completed ? ' is-done' : '');
      item.dataset.id = t.id;
      const make = (tag, cls, text) => {
        const el = document.createElement(tag);
        el.className = cls; el.textContent = text; return el;
      };
      item.append(
        make('strong', 'task-title', t.title),
        make('span', 'task-description', t.description ?? ''),
        make('em', 'task-status', t.completed ? 'done' : 'to do'),
        make('button', 'toggle-task', t.completed ? 'Undo' : 'Done'),
        make('button', 'edit-task', 'Edit'),
        make('button', 'delete-task', 'Delete'),
      );
      return item;
    }));
  }

  async onSubmit(e) {
    e.preventDefault();
    const payload = { title: this.els.title.value.trim(), description: this.els.desc.value.trim() };
    if (!payload.title) return this.notify('Please enter a title', true);
    try {
      if (this.editingId) {
        await this.request(`tasks?id=eq.${this.editingId}`, 'PATCH', payload);
        this.notify('Task updated');
      } else {
        await this.request('tasks', 'POST', { ...payload, completed: false });
        this.notify('Task created');
      }
      this.editingId = null;
      this.els.form.reset();
      this.els.submit.textContent = 'Add';
      await this.refresh();
    } catch (err) { this.notify(`Save failed – ${err.message}`, true); }
  }

  async onListClick(e) {
    const btn = e.target.closest('button');
    const item = e.target.closest('.task-item');
    if (!btn || !item) return;
    const id = Number(item.dataset.id);
    const task = this.tasks.find((t) => t.id === id);
    try {
      if (btn.classList.contains('delete-task')) {
        await this.request(`tasks?id=eq.${id}`, 'DELETE');
        this.notify('Task deleted');
      } else if (btn.classList.contains('toggle-task')) {
        await this.request(`tasks?id=eq.${id}`, 'PATCH', { completed: !task.completed });
        this.notify('Status changed');
      } else if (btn.classList.contains('edit-task')) {
        this.editingId = id;
        this.els.title.value = task.title;
        this.els.desc.value = task.description ?? '';
        this.els.submit.textContent = 'Save';
        this.els.title.focus();
        return;
      }
      await this.refresh();
    } catch (err) { this.notify(`Action failed – ${err.message}`, true); }
  }
}
new TaskApp().start();
