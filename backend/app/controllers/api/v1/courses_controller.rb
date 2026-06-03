module Api
  module V1
    class CoursesController < BaseController
      before_action :set_course, only: [:show, :update, :destroy]

      def index
        courses = Course.active_first.includes(:course_units)
        render json: courses.map { |c| course_summary(c) }
      end

      def show
        render json: course_payload(@course)
      end

      def create
        course = Course.create!(course_params)
        render json: course_payload(course), status: :created
      end

      def update
        @course.update!(course_params)
        render json: course_payload(@course)
      end

      def destroy
        # Hard delete (matches projects/links convention). Cascades to units and
        # all polymorphic notes/links via dependent: :destroy. Use status:"archived"
        # via update for a soft archive instead.
        @course.destroy!
        head :no_content
      end

      # POST /api/v1/courses/bulk_upsert — agent-friendly bulk add/update/delete.
      # Rescued controller-local (small blast radius) → structured 422.
      def bulk_upsert
        result = Courses::BulkUpsertService.new(bulk_params).call
        render json: result, status: :ok
      rescue Courses::BulkUpsertError => e
        render json: { error: "Bulk upsert failed", details: e.details }, status: :unprocessable_entity
      end

      private

      def set_course
        @course = Course.find(params[:id])
      end

      def course_params
        params.require(:course).permit(
          :title, :description, :status, :provider, :diploma, :diploma_notes,
          :started_on, :completed_on, :external_id, metadata: {}
        )
      end

      # Permit the full nested agent payload untouched (validated inside the service).
      def bulk_params
        params.permit!.to_h.slice("courses", "operations", "deletes", "ignore_missing_deletes")
      end

      # ── Serialization (plain as_json, app convention) ──────────────────────────

      def course_summary(course)
        course.as_json.merge(
          "units_count" => course.units_count,
          "notes_count" => course.notes_count,
          "links_count" => course.links_count
        )
      end

      def course_payload(course)
        course.as_json.merge(
          "units" => course.course_units.ordered.map { |u| unit_payload(u) },
          "notes" => course.notes.ordered.as_json,
          "links" => course.links.recent_first.as_json,
          "units_count" => course.units_count,
          "notes_count" => course.notes_count,
          "links_count" => course.links_count
        )
      end

      def unit_payload(unit)
        unit.as_json.merge(
          "notes" => unit.notes.ordered.as_json,
          "links" => unit.links.recent_first.as_json
        )
      end
    end
  end
end
