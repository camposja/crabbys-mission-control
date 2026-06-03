module Courses
  # Raised by BulkUpsertService for any payload problem. Carries a list of
  # structured `details` (locked shape) that the controller renders as a 422.
  #
  #   { entity:, operation: "upsert"|"delete", external_id:, id:, path:, message: }
  class BulkUpsertError < StandardError
    attr_reader :details

    def initialize(details)
      @details = Array(details)
      super(@details.map { |d| d[:message] }.compact.join("; ").presence || "bulk upsert failed")
    end
  end
end
