
export enum ClipTypes {
  Link = "Link",
  Emoji = "Emoji",
  Text = "Text",
  Code = "Code",
  Color = "Color",
  File = "File",
  Image = "Image",
}

export interface ClipEntry {
  id: string;
  value: string | string[];
  stared: boolean;
  myClipType: ClipTypes;
}

