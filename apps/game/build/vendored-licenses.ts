export interface VendoredLicense {
  /** The license the package's manifest must declare. */
  readonly license: string;
  /** The text's file name in the `licenses/` directory beside this module. */
  readonly file: string;
  /** Where the text was copied from, verbatim, at the released version. */
  readonly source: string;
}

export interface VendoredLicenses {
  readonly directory: string;
  /** Keyed by `name@version`. */
  readonly entries: Readonly<Record<string, VendoredLicense>>;
}

/**
 * License texts for distributed packages whose published package omits its
 * license file. Each entry covers one exact version and its declared license,
 * so upgrading the package fails the build until its text is checked again.
 */
export const VENDORED_LICENSES: VendoredLicenses["entries"] = {
  "@react-three/fiber@9.7.0": {
    license: "MIT",
    file: "react-three-fiber-9.7.0.LICENSE",
    source: "https://github.com/pmndrs/react-three-fiber/blob/v9.7.0/LICENSE",
  },
};
