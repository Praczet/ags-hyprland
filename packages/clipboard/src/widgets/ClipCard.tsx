import Gtk from "gi://Gtk";
import { getContrastColor } from "../../../../shared/utils/colors";
import { deleteClip, toggleClipStar } from "../vault";
import { ClipEntry, ClipTypes } from "../types";



function CCHeaderIcon(props: { mclType: ClipTypes }) {
  const { mclType } = props;
  return <image
    class="myclip-icon"
    pixelSize={24}
    iconName={getHeaderImageForType(mclType)} />
}

function getHeaderImageForType(mclType: ClipTypes): string {
  switch (mclType) {
    case ClipTypes.Link:
      return "emblem-web-symbolic";
    case ClipTypes.Emoji:
      return "face-smile-symbolic";
    case ClipTypes.Text:
      return "text-symbolic";
    case ClipTypes.Code:
      return "utilities-terminal-symbolic";
    case ClipTypes.Color:
      return "color-picker-symbolic";
    case ClipTypes.File:
      return "text-x-generic-symbolic";
    case ClipTypes.Image:
      return "image-x-generic-symbolic";
    default:
      return "text-x-generic-symbolic";
  }
}

function Info(props: { entry: ClipEntry }) {
  return (
    <box
      class="myclip-header-info"
      orientation={Gtk.Orientation.VERTICAL}
      hexpand={true}
    >
      <label class="mcl-h--info-type" label={props.entry.myClipType.toString()} />
      <label class="mcl-h--info-date" label="..." />
    </box>
  )
}

function Actions(props: { entry: ClipEntry }) {
  return (
    <box
      class="myclip-actions"
      orientation={Gtk.Orientation.HORIZONTAL}
      vexpand={false}
      spacing={5}
    >
      <button
        class={`mcl-action-btn mcl-action--star ${props.entry.stared ? 'stared' : ''}`}
        vexpand={false}
        valign={Gtk.Align.START}
        onClicked={async () => {
          await toggleClipStar(props.entry.id);
        }}
      >
        <image iconName="starred-symbolic" pixelSize={16} />
      </button>
      <button
        class="mcl-action-btn mcl-action--del"
        vexpand={false}
        valign={Gtk.Align.START}
        onClicked={async () => {
          await deleteClip(props.entry.id);
        }}
      >
        <image iconName="edit-delete-symbolic" pixelSize={16} />
      </button>
    </box>
  )
}

function Header(props: { entry: ClipEntry }) {
  return (
    <box
      class="myclip-header"
      orientation={Gtk.Orientation.HORIZONTAL}
    >
      <CCHeaderIcon mclType={props.entry.myClipType} />
      <Info entry={props.entry} />
      <Actions entry={props.entry} />
    </box>
  )
}

function ContentPicture(props: { entry: ClipEntry }) {
  const filePath = `${Array.isArray(props.entry.value) ? props.entry.value[0] : props.entry.value}`;
  const resolution = Array.isArray(props.entry.value) ? props.entry.value[2] : "N/A";
  return (
    <Gtk.Overlay
      hexpand={true}
      vexpand={true}
    >
      <box
        hexpand={true}
        heightRequest={110} // You usually need a fixed height for this
        css={`
            background-image: url("file://${filePath}");
            background-size: cover;
            background-position: center;
        `}
      />
      <box
        $type="overlay"
        // Alignments decide WHERE it sits (Center, Top, Bottom, etc.)
        valign={Gtk.Align.END}  // Sit at the bottom
        halign={Gtk.Align.FILL} // Stretch full width
        class="overlay-box"
        css={`
                    background-color: rgba(0, 0, 0, 0.6); /* 60% opaque black */
                    padding: 10px;
                `}
      >
        <label
          label={resolution}
          hexpand={true}
          cssClasses={["mycli-image-label"]}
        />
      </box>
    </Gtk.Overlay>
  )
}

function ContentText(props: { entry: ClipEntry }) {
  return (
    <box class="myclip-content-text mcl-content"
      width_request={150}
      height_request={110}
    >
      <scrolledwindow
        maxContentHeight={110}
        maxContentWidth={140}
        vexpand={true}
        hexpand={true}
      >
        <label
          widthRequest={140}
          valign={Gtk.Align.CENTER}
          wrap={true}
          label={Array.isArray(props.entry.value) ? props.entry.value.join("\n") : props.entry.value}
        />
      </scrolledwindow>
    </box>
  )
}

function ContentCode(props: { entry: ClipEntry }) {
  return (
    <box class="myclip-content-code mcl-content"
      width_request={150}
      height_request={110}
    >
      <scrolledwindow
        maxContentHeight={110}
        maxContentWidth={140}
        vexpand={true}
        hexpand={true}
      >
        <label
          widthRequest={140}
          valign={Gtk.Align.CENTER}
          label={Array.isArray(props.entry.value) ? props.entry.value.join("\n") : props.entry.value}
        />
      </scrolledwindow>
    </box>
  )
}

function Color(props: { entry: ClipEntry }) {
  const color = getContrastColor(Array.isArray(props.entry.value) ? props.entry.value[0] : props.entry.value);
  return (
    <box
      class="myclip-content-color mcl-content"
      css={`background-color: ${Array.isArray(props.entry.value) ? props.entry.value[0] : props.entry.value};`}
      hexpand={true}
      vexpand={true}
    >
      <label
        vexpand={true}
        hexpand={true}
        css={`color: ${color}; font-weight: bold;`}
        label={
          Array.isArray(props.entry.value)
            ? props.entry.value.length === 2 ? props.entry.value[1] : props.entry.value[0]
            : props.entry.value
        }
      />
    </box>
  )
}

function Content(props: { entry: ClipEntry }) {
  switch (props.entry.myClipType) {
    case ClipTypes.Image:
      return ContentPicture(props);
    case ClipTypes.Text:
      return ContentText(props);
    case ClipTypes.Code:
      return ContentCode(props);
    case ClipTypes.Color:
      return Color(props);
    default:
      return ContentText(props);
  }
}

export default function ClipCard(props: { entry: ClipEntry }) {
  return (
    <box
      class="myclip-entry"
      height_request={150}
      width_request={150}
      vexpand={false}
      hexpand={false}
      halign={Gtk.Align.CENTER}
      overflow={Gtk.Overflow.HIDDEN}
      orientation={Gtk.Orientation.VERTICAL}
    >
      <Header entry={props.entry} />
      <box
        class="myclip-content-container"
        vexpand={true}
        hexpand={true}
        overflow={Gtk.Overflow.HIDDEN}
      >
        <Content entry={props.entry} />
      </box>
    </box>
  )
}

// color-mix(in srgb, red 50%, blue 50%);
