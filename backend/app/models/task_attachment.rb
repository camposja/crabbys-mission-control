class TaskAttachment < ApplicationRecord
  ALLOWED_EXTENSIONS = %w[.txt .md].freeze

  belongs_to :task

  validates :filename, presence: true
  validates :content, presence: true
  validate  :allowed_file_type

  private

  def allowed_file_type
    ext = File.extname(filename.to_s).downcase
    unless ALLOWED_EXTENSIONS.include?(ext)
      errors.add(:filename, "must be .txt or .md (got #{ext})")
    end
  end
end
