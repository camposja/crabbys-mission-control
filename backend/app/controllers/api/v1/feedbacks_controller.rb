module Api
  module V1
    class FeedbacksController < BaseController
      # GET /api/v1/feedbacks
      def index
        feedbacks = Feedback.order(created_at: :desc).limit(50)
        render json: feedbacks
      end

      # GET /api/v1/feedbacks/:id
      def show
        render json: Feedback.find(params[:id])
      end

      # POST /api/v1/feedbacks
      # Accepts user feedback, saves it, and enqueues an AI processing job
      def create
        feedback = Feedback.create!(feedback_params)

        # Enqueue AI job to generate a feature branch / code snippet
        FeedbackProcessorJob.perform_later(feedback.id)

        ::EventStore.emit(
          type:    "feedback_submitted",
          message: "New #{feedback.feedback_type}: #{feedback.title}",
          metadata: { feedback_id: feedback.id }
        )

        render json: feedback, status: :created
      end

      # PATCH /api/v1/feedbacks/:id/status
      def update_status
        feedback = Feedback.find(params[:id])
        feedback.update!(status: params[:status])
        render json: feedback
      rescue ActiveRecord::RecordInvalid => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      private

      def feedback_params
        params.require(:feedback).permit(:title, :description, :feedback_type, :url, metadata: {})
      end
    end
  end
end
