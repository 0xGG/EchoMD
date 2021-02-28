// Modified from github.com/shd101wyy/mume

export function uslug(str: string, separater = "-"): string {
  return str.replace(
    /[\.\s!@#$%^&*()\-=_+~`[\]{}\\<>?\/\|（）【】:：，。]+/g,
    separater
  );
}

export default class HeadingIdGenerator {
  private table: { [key: string]: number };
  constructor() {
    this.table = {};
  }
  public generateId(heading: string): string {
    heading = heading.trim();
    heading = heading.replace(/。/g, ""); // sanitize
    let slug = uslug(heading);
    if (this.table[slug] >= 0) {
      this.table[slug] = this.table[slug] + 1;
      slug += "-" + this.table[slug];
    } else {
      this.table[slug] = 0;
    }
    return slug;
  }
}
