# frozen_string_literal: true

# BPFLab blog helpers.
#
# Custom Liquid filters:
#   author_name  — extracts the display name from an `author` front-matter value
#                  written as `Name <email>`.
#   gravatar     — builds a Gravatar profile-image URL from the same value
#                  (`{{ post.author | gravatar: 96 }}`). When the e-mail has no
#                  Gravatar account, identicon fallback keeps the layout stable.
#   jdate        — renders a Gregorian date as a Persian (Jalali) date string,
#                  e.g. «۱۱ مهر ۱۴۰۵».
#   to_persian   — converts Western digits to Persian digits.
#   reading_time — rough reading-time estimate in minutes for Persian text.
#
# Loaded automatically from _plugins/ (Jekyll must not run in safe mode).
# GitHub Pages would ignore this file; this blog is built outside Pages.

require "digest/md5"
require "date"

module BPFLab
  AUTHOR_FORMAT = /\A\s*(.+?)\s*<\s*([^>]+?)\s*>\s*\z/.freeze

  # Parses `Name <email>`; returns [name, email] where email may be nil.
  def self.parse_author(author)
    return [author["name"], nil] if author.is_a?(Hash)

    str = author.to_s.strip
    if (match = str.match(AUTHOR_FORMAT))
      [match[1], match[2]]
    else
      [str, nil]
    end
  end
end

module BPFLabFilters
  JALALI_MONTHS = %w[
    فروردین اردیبهشت خرداد تیر مرداد شهریور مهر آبان آذر دی بهمن اسفند
  ].freeze
  PERSIAN_DIGITS = %w[۰ ۱ ۲ ۳ ۴ ۵ ۶ ۷ ۸ ۹].freeze
  WORDS_PER_MINUTE = 200

  def author_name(author)
    BPFLab.parse_author(author)[0]
  end

  def gravatar(author, size = 96)
    size = [[size.to_i, 1].max, 2048].min
    if author.is_a?(Hash) && author["avatar_hash"]
      return "https://secure.gravatar.com/avatar/#{author['avatar_hash']}?s=#{size}&d=identicon&r=g"
    end

    name, email = BPFLab.parse_author(author)
    hash = Digest::MD5.hexdigest((email || name).to_s.strip.downcase)
    "https://secure.gravatar.com/avatar/#{hash}?s=#{size}&d=identicon&r=g"
  end

  def jdate(input)
    date = input.is_a?(Date) || input.is_a?(Time) ? input : Date.parse(input.to_s)
    jy, jm, jd = gregorian_to_jalali(date.year, date.month, date.day)
    "#{to_persian(jd)} #{JALALI_MONTHS[jm - 1]} #{to_persian(jy)}"
  rescue ArgumentError, TypeError
    input.to_s
  end

  def to_persian(input)
    input.to_s.gsub(/[0-9]/) { |digit| PERSIAN_DIGITS[digit.to_i] }
  end

  def reading_time(input)
    words = input.to_s.gsub(/<[^>]*>/, " ").split(/\s+/).length
    minutes = [1, (words / WORDS_PER_MINUTE.to_f).ceil].max
    to_persian(minutes)
  end

  private

  # Arithmetic Gregorian → Jalali conversion, tested at Nowruz/leap boundaries.
  RUBY_G_D_M = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334].freeze

  def gregorian_to_jalali(gy, gm, gd)
    gy2 = gm > 2 ? gy + 1 : gy
    days = 355_666 + (365 * gy) + ((gy2 + 3) / 4) - ((gy2 + 99) / 100) +
           ((gy2 + 399) / 400) + gd + RUBY_G_D_M[gm - 1]

    jy = -1595 + (33 * (days / 12053))
    days = (days % 12053)
    jy += 4 * (days / 1461)
    days %= 1461

    if days > 365
      jy += (days - 1) / 365
      days = (days - 1) % 365
    end

    if days < 186
      jm = 1 + (days / 31)
      jd = 1 + (days % 31)
    else
      jm = 7 + ((days - 186) / 30)
      jd = 1 + ((days - 186) % 30)
    end

    [jy, jm, jd]
  end
end

Liquid::Template.register_filter(BPFLabFilters)

# Keep the required front-matter format, but give SEO/feed plugins a structured
# display name instead of publishing the email in metadata and RSS.
Jekyll::Hooks.register :site, :post_read do |site|
  site.posts.docs.each do |post|
    name, email = BPFLab.parse_author(post.data["author"])
    unless email && email.match?(/\A[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+\z/)
      raise Jekyll::Errors::FatalException,
            "#{post.relative_path}: author must be written as Name <email>"
    end

    post.data["author"] = {
      "name" => name,
      "avatar_hash" => Digest::MD5.hexdigest(email.strip.downcase),
    }
    post.data["description"] ||= post.data["summary"]
  end
end
