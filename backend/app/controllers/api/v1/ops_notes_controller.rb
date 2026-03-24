module Api
  module V1
    class OpsNotesController < BaseController
      before_action :set_ops_note, only: [:show, :update, :destroy]

      def index
        notes = OpsNote.recent
        notes = notes.search(params[:q].to_s.strip) if params[:q].present?
        notes = notes.by_category(params[:category]) if params[:category].present?
        notes = notes.by_tag(params[:tag]) if params[:tag].present?
        notes = notes.pinned_only if ActiveModel::Type::Boolean.new.cast(params[:pinned])

        render json: {
          notes: notes.limit(200).as_json,
          meta: {
            categories: OpsNote.where.not(category: [nil, ""]).distinct.order(:category).pluck(:category),
            tags: OpsNote.pluck(:tags).flatten.compact.uniq.sort
          }
        }
      end

      def show
        touch_last_used! if params[:touch].to_s == "true"
        render json: @ops_note
      end

      def create
        note = OpsNote.create!(ops_note_params)
        render json: note, status: :created
      end

      def update
        @ops_note.update!(ops_note_params)
        render json: @ops_note
      end

      def destroy
        @ops_note.destroy!
        head :no_content
      end

      private

      def set_ops_note
        @ops_note = OpsNote.find(params[:id])
      end

      def touch_last_used!
        @ops_note.update_column(:last_used_at, Time.current)
      end

      def ops_note_params
        params.require(:ops_note).permit(
          :title, :slug, :body, :category, :pinned, :last_used_at,
          :command_snippet, :notes_format, :status,
          tags: [],
          source_links: [:label, :url, :source_type]
        )
      end
    end
  end
end
