module Api
  module V1
    class LinksController < BaseController
      # SECURITY: whitelist polymorphic owner classes for the new course/unit path.
      ALLOWED_LINKABLES = %w[Course CourseUnit].freeze

      before_action :set_link, only: [:update, :destroy]

      def index
        links = Link.recent_first
        # Legacy project/task filters — unchanged.
        links = links.for_project(params[:project_id]) if params[:project_id].present?
        links = links.for_task(params[:task_id]) if params[:task_id].present?
        # New polymorphic owner filter.
        if params[:linkable_type].present? || params[:linkable_id].present?
          return unless valid_linkable?(params[:linkable_type])

          links = links.for_linkable(params[:linkable_type], params[:linkable_id])
        end
        render json: links
      end

      def create
        return if link_params[:linkable_type].present? && !valid_linkable?(link_params[:linkable_type])

        link = Link.create!(link_params)
        render json: link, status: :created
      end

      def update
        # Owner is immutable on update — project/task/linkable cannot be reassigned.
        @link.update!(update_link_params)
        render json: @link
      end

      def destroy
        @link.destroy!
        head :no_content
      end

      private

      def set_link
        @link = Link.find(params[:id])
      end

      def link_params
        params.require(:link).permit(
          :project_id, :task_id, :linkable_type, :linkable_id,
          :url, :title, :source_type, :notes, :external_id, metadata: {}
        )
      end

      # Update never reassigns the owner — owner-changing keys are intentionally omitted.
      def update_link_params
        params.require(:link).permit(:url, :title, :source_type, :notes, :external_id, metadata: {})
      end

      # Returns true if whitelisted; otherwise renders 422 and returns false.
      def valid_linkable?(type)
        return true if ALLOWED_LINKABLES.include?(type.to_s)

        render json: { error: "Unsupported linkable_type: #{type.inspect}" },
               status: :unprocessable_entity
        false
      end
    end
  end
end
