# frozen_string_literal: true

require "minitest/autorun"
require "jekyll"
require "tmpdir"
require "fileutils"
require "rexml/document"
require_relative "../_plugins/bpflab"

class BlogHelpersTest < Minitest::Test
  def setup
    @filters = Object.new.extend(BPFLabFilters)
  end

  def test_author_name_and_email_normalization
    assert_equal "نویسنده", @filters.author_name(" نویسنده < Person@Example.com > ")
    hash = Digest::MD5.hexdigest("person@example.com")
    assert_equal "https://secure.gravatar.com/avatar/#{hash}?s=64&d=identicon&r=g",
                 @filters.gravatar("نویسنده < Person@Example.com >", 64)
    assert_equal @filters.gravatar("نویسنده <person@example.com>", 64),
                 @filters.gravatar({ "name" => "نویسنده", "avatar_hash" => hash }, 64)
    assert_equal "نویسنده", @filters.author_name({ "name" => "نویسنده" })
  end

  def test_jalali_dates_at_calendar_boundaries
    {
      "2024-03-20" => "۱ فروردین ۱۴۰۳",
      "2025-03-20" => "۳۰ اسفند ۱۴۰۳",
      "2025-03-21" => "۱ فروردین ۱۴۰۴",
      "2026-01-01" => "۱۱ دی ۱۴۰۴",
      "2026-03-21" => "۱ فروردین ۱۴۰۵",
      "2026-09-23" => "۱ مهر ۱۴۰۵",
      "2026-10-11" => "۱۹ مهر ۱۴۰۵",
    }.each do |date, expected|
      assert_equal expected, @filters.jdate(Date.parse(date)), date
    end
    assert_equal "invalid", @filters.jdate("invalid")
  end

  def test_reading_time_and_digits
    assert_equal "۱", @filters.reading_time("")
    assert_equal "۳", @filters.reading_time("<p>#{'word ' * 450}</p>")
    assert_equal "۰۱۲۳۴۵۶۷۸۹", @filters.to_persian("0123456789")
  end
end

class BlogBuildTest < Minitest::Test
  SOURCE = File.expand_path("..", __dir__)

  def setup
    temp_root = File.directory?("/tmp/opencode") ? "/tmp/opencode" : Dir.tmpdir
    @tmp = Dir.mktmpdir("bpflab-blog-", temp_root)
    @source = File.join(@tmp, "source")
    @output = File.join(@tmp, "output")
    FileUtils.mkdir_p(@source)
    # Load helpers above; omit plugin copies to avoid registering hooks twice.
    %w[_config.yml _includes _layouts _sass assets _posts index.html about.md 404.html robots.txt CNAME].each do |path|
      FileUtils.cp_r(File.join(SOURCE, path), @source)
    end
    @config = Jekyll.configuration(
      "source" => @source,
      "destination" => @output,
      "baseurl" => "/preview",
      "paginate" => 1,
      "quiet" => true,
      "strict_front_matter" => true,
    )
  end

  def teardown
    FileUtils.remove_entry(@tmp)
  end

  def build
    site = Jekyll::Site.new(@config)
    site.process
    site
  end

  def html(path)
    File.read(File.join(@output, path))
  end

  def test_generated_pages_metadata_pagination_and_assets
    # Verify personal author emails do not leak into SEO/RSS or page content.
    fixture = File.join(@source, "_posts/2026-10-10-verifier-diagnostics.md")
    File.write(fixture, File.read(fixture).sub("تیم BPFLab <help@bpflab.ir>", "Test Writer <personal@example.com>"))
    build
    home = html("index.html")
    assert_includes home, '<html lang="fa" dir="rtl">'
    assert_includes home, '<head>'
    assert_includes home, 'href="/preview/page/2/"'
    assert_includes home, 'verifier-diagnostics/'
    assert_includes home, 'Test Writer'
    assert_includes home, 'referrerpolicy="no-referrer"'
    assert_includes html("page/2/index.html"), 'firecracker-microvm/'
    assert_includes html("page/3/index.html"), 'what-is-ebpf/'

    post = html("2026/10/10/verifier-diagnostics/index.html")
    assert_includes post, 'https://blog.bpflab.ir/preview/2026/10/10/verifier-diagnostics/'
    assert_includes post, '۱۸ مهر ۱۴۰۵'
    assert_includes post, 'language-c'
    assert_includes post, 'نوشتهٔ قدیمی‌تر'
    refute_includes post, 'نوشتهٔ جدیدتر'
    assert_includes html("2026/10/08/what-is-ebpf/index.html"), 'نوشتهٔ جدیدتر'
    assert_includes html("404.html"), '404'
    assert_includes html("robots.txt"), 'https://blog.bpflab.ir/preview/sitemap.xml'
    assert_equal "blog.bpflab.ir\n", html("CNAME")

    Dir.glob(File.join(@output, "**/*.html")).each do |page|
      contents = File.read(page)
      refute_includes contents, "personal@example.com", page
      # All internal page/asset links work with a non-empty baseurl.
      contents.scan(/(?:href|src)="(\/[^"?#]*)/).flatten.each do |url|
        next if url.start_with?("//")

        assert url.start_with?("/preview/"), "Unprefixed local URL: #{url}"
        local = File.join(@output, url.delete_prefix("/preview/"))
        local = File.join(local, "index.html") if File.directory?(local)
        assert File.file?(local), "Broken local URL: #{url} in #{page}"
      end
    end
    %w[feed.xml sitemap.xml].each do |path|
      xml = html(path)
      REXML::Document.new(xml)
      refute_includes xml, "personal@example.com"
      assert_includes xml, "https://blog.bpflab.ir/preview/"
    end
    refute File.exist?(File.join(@output, "_plugins"))
    refute File.exist?(File.join(@output, "test"))
  end

  def test_placeholder_and_summary_fallback
    fixture = File.join(@source, "_posts/2026-10-10-verifier-diagnostics.md")
    File.write(fixture, File.read(fixture).gsub(/^image:.*\n|^summary:.*\n/, ""))
    build
    assert_includes html("index.html"), 'src="/preview/assets/images/placeholder.svg"'
    assert_includes html("index.html"), "کامپایل موفق"
  end

  def test_invalid_author_fails_build
    fixture = File.join(@source, "_posts/2026-10-10-verifier-diagnostics.md")
    File.write(fixture, File.read(fixture).sub("تیم BPFLab <help@bpflab.ir>", "No email"))
    error = assert_raises(Jekyll::Errors::FatalException) { build }
    assert_includes error.message, "author must be written as Name <email>"
  end
end
