import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import { Turnstile } from "./turnstile.tsx";
import { formatDate } from "~/utils/chinese-calendar.ts";
import { UAParser } from "ua-parser-js";
import {
  signAddComment,
  signDeleteComment,
  Comment,
  sitekey,
  origin,
} from "./utils.ts";
import {
  exportPrivateKey,
  exportPublicKey,
  generateKeys,
  importPrivateKey,
  importPublicKey,
} from "~/utils/crypto.ts";
import { ArknightsAvatar } from "./arknights.tsx";
import md5 from "blueimp-md5";

type Props = {
  path: string;
};

function getString(something: {
  name: string | undefined;
  version: string | undefined;
}) {
  if (something.name) {
    if (something.version) return `${something.name}/${something.version}`;
    return something.name;
  }
  return null;
}

function CommentComponent(props: {
  comment: Comment;
  identity: string;
  onDelete: (uuid: string) => void;
}) {
  const name = props.comment.name.trim() || "匿名用户";
  // const site = props.comment.site.trim();
  // const avatarURL = getAvatarURL(props.comment.avatar.trim());
  const content = props.comment.content.trim();
  const time = formatDate(props.comment.time);
  const parser = new UAParser(props.comment.userAgent.trim());
  const browser = getString(parser.getBrowser());
  const os = getString(parser.getOS());
  const hash = useMemo(
    () =>
      (parseInt(md5(props.comment.pubkey).toLowerCase(), 16) % 10000)
        .toString()
        .padStart(4, "0"),
    [props.comment.pubkey],
  );

  return (
    <div class="clear-both mx-6 my-4">
      <span class="float-right select-none">
        <ArknightsAvatar
          id={props.comment.pubkey}
          class="h-20 w-20 object-cover"
        />
      </span>

      <div>
        <b>
          {name}#{hash}
        </b>
        <span class="ml-3 text-sm">{time}</span>
        {browser && <span class="ml-3 text-sm">{browser}</span>}
        {os && <span class="ml-3 text-sm">{os}</span>}
        {props.identity === props.comment.pubkey && (
          <span
            class="ml-3 cursor-pointer text-sm underline"
            onClick={() => props.onDelete(props.comment.id)}
          >
            删除
          </span>
        )}
      </div>

      <div class="m-4">
        {content || (
          <span class="italic">
            他居然钻了空子发了一条空评论！但是事实上他还是什么也做不到。
          </span>
        )}
      </div>
    </div>
  );
}

type CreateCommentProps = {
  path: string;
  seckey: CryptoKey;
  pubkey: CryptoKey;
  identity: string;
  // setComments: StateUpdater<Comment[] | null>;
  // setShow: StateUpdater<boolean>;
  prependComment: (comment: Comment) => void;
  onSuccess: () => void;
  onChangeIdentity: () => void;
};

function CreateComment(props: CreateCommentProps) {
  const action = `${origin}/comment`;
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [finish, setFinish] = useState(false);

  const [meta, setMeta] = useState({ name: "" });
  // load
  useEffect(() => {
    const cache = localStorage.getItem("comments-metadata");
    if (cache) setMeta(JSON.parse(cache));
  }, []);
  // save
  useEffect(() => {
    localStorage.setItem("comments-metadata", JSON.stringify(meta));
  }, [meta]);

  return (
    <p>
      <form
        method="POST"
        action={action}
        onSubmit={(event) => {
          event.preventDefault();

          const formData = new FormData(event.currentTarget, event.submitter);
          setSubmitting(true);

          (async () => {
            try {
              if (!props.seckey || !props.pubkey) {
                return alert("KeyPair is missing");
              }

              await signAddComment(formData, props.pubkey, props.seckey);

              const response = await fetch(action, {
                method: "POST",
                body: formData,
              });
              if (response.status !== 200) {
                const message = await response.text();
                alert(`Error: ${message}`);
                return;
              }
              const data = (await response.json()) as {
                ok: true;
                comment: Comment;
              };
              props.prependComment(data.comment);
              if (textarea.current) {
                textarea.current.value = "";
              }
            } finally {
              setSubmitting(false);
              props.onSuccess();
            }
          })();
        }}
      >
        <input type="hidden" name="path" value={props.path} />
        <div class="grid grid-cols-3 gap-2">
          <input
            type="text"
            name="name"
            class="col-span-3"
            placeholder="尊姓大名"
            value={meta.name}
            onInput={(e) =>
              setMeta((meta) => ({ ...meta, name: e.currentTarget.value }))
            }
          />
          <textarea
            name="content"
            class="col-span-3 h-24 min-h-24"
            ref={textarea}
            required
            placeholder="不支持 Markdown"
          />
          <div class="col-span-3">
            <div class="flex items-center justify-between">
              <div onClick={() => props.onChangeIdentity()}>
                <ArknightsAvatar
                  id={props.identity}
                  class="h-20 w-20 object-cover"
                />
              </div>
              <Turnstile sitekey={sitekey} onSuccess={() => setFinish(true)} />
            </div>
          </div>
          <button
            disabled={submitting || !finish}
            class="col-span-3 border-2 border-slate-800 disabled:pointer-events-none disabled:opacity-60 dark:border-slate-100"
          >
            {submitting ? "提交中..." : "提交评论"}
          </button>
        </div>
      </form>
    </p>
  );
}

export function Comments(props: Props) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [show, setShow] = useState(false);

  const [pubkey, setPubkey] = useState<CryptoKey | null>(null);
  const [seckey, setSeckey] = useState<CryptoKey | null>(null);
  const [identity, setIdentity] = useState("nobody");

  const refreshKeys = useCallback(async () => {
    const keypair = await generateKeys();
    const pubkey = await exportPublicKey(keypair.publicKey);
    setPubkey(keypair.publicKey);
    setSeckey(keypair.privateKey);
    setIdentity(pubkey);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const pubkey = localStorage.getItem("blog.pubkey");
        const seckey = localStorage.getItem("blog.seckey");
        if (!pubkey || !seckey) throw new Error();
        const publicKey = await importPublicKey(pubkey);
        const privateKey = await importPrivateKey(seckey);
        setPubkey(publicKey);
        setSeckey(privateKey);
        setIdentity(pubkey);
      } catch {
        await refreshKeys();
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (pubkey)
        localStorage.setItem("blog.pubkey", await exportPublicKey(pubkey));
      if (seckey)
        localStorage.setItem("blog.seckey", await exportPrivateKey(seckey));
    })();
  }, [pubkey, seckey]);

  useEffect(() => {
    const abort = new AbortController();
    const url = `${origin}/comments?path=${props.path}`;
    fetch(url, { signal: abort.signal })
      .then((resp) => resp.json())
      .then((data: { count: number; path: string; comments: Comment[] }) => {
        const comments = data.comments;
        comments.sort((a, b) => b.time - a.time);
        setComments(comments);
      });

    return () => {
      abort.abort();
    };
  }, []);

  const [invisible, setInvisible] = useState<string[]>([]);
  const visibleComments = useMemo(
    () => comments && comments.filter(({ id }) => !invisible.includes(id)),
    [comments, invisible],
  );

  return (
    <>
      <p>
        <button
          class="col-span-3 border-2 border-slate-800 px-8 dark:border-slate-100"
          onClick={() => setShow((show) => !show)}
        >
          {show ? "关闭" : "添加评论"}
        </button>
      </p>

      {show && (
        <CreateComment
          path={props.path}
          seckey={seckey!}
          pubkey={pubkey!}
          identity={identity}
          prependComment={(comment) => {
            setComments((comments) => [comment, ...(comments || [])]);
          }}
          onSuccess={() => setShow(false)}
          onChangeIdentity={() => {
            refreshKeys();
          }}
        />
      )}

      {visibleComments === null ? (
        <p class="italic opacity-60">少女祈祷中...</p>
      ) : visibleComments.length === 0 ? (
        <p class="italic opacity-60">暂时没有评论</p>
      ) : (
        visibleComments.map((comment) => (
          <CommentComponent
            comment={comment}
            identity={identity}
            key={comment.id}
            onDelete={async (uuid) => {
              if (!pubkey || !seckey) {
                return alert("keypair missing");
              }
              const formData = new FormData();
              formData.append("path", props.path);
              formData.append("uuid", uuid);
              await signDeleteComment(formData, pubkey, seckey);
              const response = await fetch(`${origin}/delete`, {
                method: "POST",
                body: formData,
              });
              const json = (await response.json()) as { ok: true };
              if (json.ok) {
                setInvisible((invisible) => [...invisible, uuid]);
              }
            }}
          />
        ))
      )}
    </>
  );
}
