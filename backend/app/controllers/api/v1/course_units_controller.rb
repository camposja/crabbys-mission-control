module Api
  module V1
    class CourseUnitsController < BaseController
      before_action :set_course
      before_action :set_unit, only: [:update, :destroy]

      def index
        render json: @course.course_units.ordered.as_json
      end

      def create
        unit = @course.course_units.create!(unit_params)
        render json: unit, status: :created
      end

      def update
        @unit.update!(unit_params)
        render json: @unit
      end

      def destroy
        @unit.destroy!
        head :no_content
      end

      # PATCH /api/v1/courses/:course_id/units/reorder { ordered_ids: [3,1,2] }
      # Atomic: rewrites position for ALL of the course's units in one transaction.
      # Guards that every supplied id belongs to this course (else 422).
      def reorder
        ids = Array(params[:ordered_ids]).map(&:to_i)
        scoped_ids = @course.course_units.pluck(:id)

        if ids.sort != scoped_ids.sort
          render json: { error: "ordered_ids must list exactly this course's unit ids" },
                 status: :unprocessable_entity
          return
        end

        CourseUnit.transaction do
          ids.each_with_index { |id, i| @course.course_units.find(id).update!(position: i + 1) }
        end
        render json: @course.course_units.ordered.as_json
      end

      private

      def set_course
        @course = Course.find(params[:course_id])
      end

      def set_unit
        @unit = @course.course_units.find(params[:id])
      end

      def unit_params
        params.require(:course_unit).permit(
          :title, :description, :position, :unit_type, :status, :external_id, metadata: {}
        )
      end
    end
  end
end
