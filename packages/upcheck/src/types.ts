type UpItem = { name: string; oldVer: string; newVer: string };

type PkgDetails = {
  name: string;
  repo?: string;
  version?: string;
  desc?: string;
  url?: string | undefined;
  arch?: string;
  depends?: string[];
  requiredby?: string[];
  optdepends?: string[];
  raw?: string; // keep raw text if you want
};

