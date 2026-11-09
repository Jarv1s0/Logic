import {Settings} from './vendor/data.mjs';
import {enabled} from './legacy-runtime.mjs';
export function settings(options) {
  // Keep saved keys and defaults. Only the subtitle service's canonical target
  // spelling changes; en-US was accepted by the old plugin and remains valid.
  const target = {'zh-CN': 'zh-Hans', 'zh-TW': 'zh-Hant', 'en-US': 'en'}[options.translation_target] || options.translation_target || 'zh-Hans';
  return new Settings({
    REMOVE_ADS: true, DEEP_FILTER: true,
    TRANSLATE_CAPTIONS: enabled(options.translation_enabled), TARGET_LANGUAGE: target,
    BILINGUAL: enabled(options.translation_bilingual),
    CAPTION_LAYOUT: options.caption_layout == null || enabled(options.caption_layout),
    AUTO_CAPTIONS: false, FALLBACK_TRANSLATION: false,
    HIDE_UPLOAD: enabled(options.hide_upload), HIDE_SHORTS: enabled(options.hide_bottom_shorts),
    DIAGNOSTICS: enabled(options.log_enabled)
  });
}
