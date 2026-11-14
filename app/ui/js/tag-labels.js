export function titleCaseTagLabel(label) {
  const spellings = { ID:'ID', CD:'CD', URL:'URL', ISRC:'ISRC', BPM:'BPM', DJ:'DJ', EAN:'EAN', UPC:'UPC',
    MP3:'MP3', FLAC:'FLAC', AIFF:'AIFF', APE:'APE', ID3:'ID3', ID3V1:'ID3v1', ID3V2:'ID3v2',
    MUSICBRAINZ:'MusicBrainz', REPLAYGAIN:'ReplayGain', DISCOGS:'Discogs', BEATPORT:'Beatport', BANDCAMP:'Bandcamp', SOUNDEO:'Soundeo' };
  return label.replace(/[\p{L}\p{N}]+/gu, word => spellings[word.toUpperCase()] || word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}
export function readableTagName(key) {
  return titleCaseTagLabel(key.replace(/^custom:/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' '));
}
