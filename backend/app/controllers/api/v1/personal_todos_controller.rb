# Personal to-do controller — Jose only.
# Intentionally separate from OpenClaw tasks/agents.
module Api
  module V1
    class PersonalTodosController < BaseController
      before_action :set_todo, only: [:update, :destroy, :toggle, :archive, :unarchive]

      # GET /personal_todos — visible (not archived) items
      def index
        render json: PersonalTodo.visible
      end

      # GET /personal_todos/archived — archived items only
      def archived
        render json: PersonalTodo.archived
      end

      # POST /personal_todos
      def create
        todo = PersonalTodo.create!(todo_params)
        render json: todo, status: :created
      end

      # PATCH /personal_todos/:id
      def update
        @todo.update!(todo_params)
        render json: @todo
      end

      # DELETE /personal_todos/:id
      def destroy
        @todo.destroy!
        head :no_content
      end

      # PATCH /personal_todos/:id/toggle
      def toggle
        @todo.update!(done: !@todo.done)
        render json: @todo
      end

      # PATCH /personal_todos/:id/archive
      def archive
        @todo.update!(archived: true)
        render json: @todo
      end

      # PATCH /personal_todos/:id/unarchive
      def unarchive
        @todo.update!(archived: false)
        render json: @todo
      end

      private

      def set_todo
        @todo = PersonalTodo.find(params[:id])
      end

      def todo_params
        params.require(:personal_todo).permit(:title, :done, :position)
      end
    end
  end
end
