module Api
  module V1
    class MemoriesController < BaseController
      before_action :set_memory, only: [:show, :update, :destroy]

      def index
        memories = Memory.recent
        memories = memories.by_agent(params[:agent_id]) if params[:agent_id].present?
        memories = memories.by_type(params[:type])      if params[:type].present?
        render json: memories.limit(100)
      end

      def show
        render json: @memory
      end

      def search
        query = params[:q].to_s.strip
        memories = Memory.where("content ILIKE ?", "%#{query}%").limit(50)
        render json: memories
      end

      def update
        @memory.update!(memory_params)
        render json: @memory
      end

      def destroy
        @memory.destroy!
        head :no_content
      end

      private

      def set_memory
        @memory = Memory.find(params[:id])
      end

      def memory_params
        params.require(:memory).permit(:content, :memory_type, :tags, :agent_id, :date, metadata: {})
      end
    end
  end
end
