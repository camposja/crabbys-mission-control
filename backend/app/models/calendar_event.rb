class CalendarEvent < ApplicationRecord
  validates :title,      presence: true
  validates :starts_at,  presence: true

  scope :upcoming, -> { where("starts_at >= ?", Time.current).order(:starts_at) }
  scope :for_range, ->(from, to) { where(starts_at: from..to) }
end
