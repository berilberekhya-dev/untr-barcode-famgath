/** Presentation casing; the imported source spelling remains unchanged in the roster. */
export function formatPersonName(value: string) {
  const name=value.trim().replace(/\s+/g,' ');
  const letters=name.replace(/[^\p{L}]/gu,'');
  const entirelyUpper=letters.length>0&&letters===letters.toLocaleUpperCase('id-ID');
  return name.split(' ').map(word=>{
    const chars=word.replace(/[^\p{L}]/gu,'');
    if(!chars)return word;
    const upper=chars===chars.toLocaleUpperCase('id-ID');
    if(upper&&(chars.length<=2||!entirelyUpper))return word;
    // Preserve deliberate internal capitals (McDonald, etc.).
    if(!upper&&word!==word.toLocaleLowerCase('id-ID')&&/[\p{Ll}][\p{Lu}]/u.test(word))return word;
    return word.toLocaleLowerCase('id-ID').replace(/(^|[-'.’])\p{L}/gu,s=>s.toLocaleUpperCase('id-ID'));
  }).join(' ');
}
