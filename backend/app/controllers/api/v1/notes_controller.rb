module Api
  module V1
    # Generic, reusable controller for the polymorphic Note model.
    # Owner is supplied via notable_type + notable_id. SECURITY: only whitelisted
    # owner classes are accepted — we never constantize arbitrary input.
    class NotesController < BaseController
      ALLOWED_NOTABLES = %w[Course CourseUnit].freeze

      before_action :set_note, only: [:update, :destroy]

      def index
        owner = resolve_owner(params[:notable_type], params[:notable_id])
        return if performed?

        render json: owner.notes.ordered.as_json
      end

      def create
        owner = resolve_owner(note_params[:notable_type], note_params[:notable_id])
        return if performed?

        note = owner.notes.create!(note_params.except(:notable_type, :notable_id))
        render json: note, status: :created
      end

      def update
        @note.update!(note_params.except(:notable_type, :notable_id))
        render json: @note
      end

      def destroy
        @note.destroy!
        head :no_content
      end

      private

      def set_note
        @note = Note.find(params[:id])
      end

      def note_params
        params.require(:note).permit(
          :notable_type, :notable_id, :note_type, :title, :body, :author,
          :external_id, metadata: {}
        )
      end

      # Returns the whitelisted owner, or renders 422 (and the action returns early).
      def resolve_owner(type, id)
        unless ALLOWED_NOTABLES.include?(type.to_s)
          render json: { error: "Unsupported notable_type: #{type.inspect}" },
                 status: :unprocessable_entity
          return nil
        end

        type.constantize.find(id) # RecordNotFound → 404 via BaseController
      end
    end
  end
end
