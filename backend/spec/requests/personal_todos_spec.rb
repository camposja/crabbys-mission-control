require "rails_helper"

RSpec.describe "PersonalTodos", type: :request do
  let!(:active_todo)    { PersonalTodo.create!(title: "Buy groceries", position: 0) }
  let!(:done_todo)      { PersonalTodo.create!(title: "Call dentist", done: true, completed_at: 1.hour.ago, position: 1) }
  let!(:archived_todo)  { PersonalTodo.create!(title: "Old task", done: true, completed_at: 2.days.ago, archived: true, archived_at: 1.day.ago, position: 2) }

  describe "GET /api/v1/personal_todos" do
    it "returns visible (non-archived) items" do
      get "/api/v1/personal_todos"
      expect(response).to have_http_status(:ok)
      ids = JSON.parse(response.body).map { |t| t["id"] }
      expect(ids).to include(active_todo.id, done_todo.id)
      expect(ids).not_to include(archived_todo.id)
    end
  end

  describe "GET /api/v1/personal_todos/archived" do
    it "returns only archived items" do
      get "/api/v1/personal_todos/archived"
      expect(response).to have_http_status(:ok)
      ids = JSON.parse(response.body).map { |t| t["id"] }
      expect(ids).to contain_exactly(archived_todo.id)
    end
  end

  describe "POST /api/v1/personal_todos" do
    it "creates a new todo" do
      post "/api/v1/personal_todos", params: { personal_todo: { title: "New task" } }
      expect(response).to have_http_status(:created)
      expect(JSON.parse(response.body)["title"]).to eq("New task")
      expect(JSON.parse(response.body)["done"]).to eq(false)
      expect(JSON.parse(response.body)["archived"]).to eq(false)
    end
  end

  describe "PATCH /api/v1/personal_todos/:id/toggle" do
    it "toggles done and sets completed_at" do
      patch "/api/v1/personal_todos/#{active_todo.id}/toggle"
      expect(response).to have_http_status(:ok)
      active_todo.reload
      expect(active_todo.done).to eq(true)
      expect(active_todo.completed_at).to be_present
    end
  end

  describe "PATCH /api/v1/personal_todos/:id/archive" do
    it "archives the item" do
      patch "/api/v1/personal_todos/#{done_todo.id}/archive"
      expect(response).to have_http_status(:ok)
      done_todo.reload
      expect(done_todo.archived).to eq(true)
      expect(done_todo.archived_at).to be_present
    end
  end

  describe "PATCH /api/v1/personal_todos/:id/unarchive" do
    it "unarchives the item" do
      patch "/api/v1/personal_todos/#{archived_todo.id}/unarchive"
      expect(response).to have_http_status(:ok)
      archived_todo.reload
      expect(archived_todo.archived).to eq(false)
      expect(archived_todo.archived_at).to be_nil
    end
  end

  describe "DELETE /api/v1/personal_todos/:id" do
    it "deletes the item" do
      delete "/api/v1/personal_todos/#{active_todo.id}"
      expect(response).to have_http_status(:no_content)
      expect(PersonalTodo.find_by(id: active_todo.id)).to be_nil
    end
  end
end
