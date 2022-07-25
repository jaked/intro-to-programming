(in-package :reveal)

(defun html (doc config)
  (let ((styles (config :styles config))
        (scripts (config :scripts config)))
    `(:progn
       (:noescape "<!doctype html>")
       ((:html :lang "en")
        (:head
         (:meta :http-equiv "content-type" :content "text/html; charset=UTF-8")
         (:meta :name "viewport" :content "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no")
         (:link :rel "stylesheet" :href "/reveal/dist/reset.css")
         (:link :rel "stylesheet" :href "/reveal/dist/reveal.css")
         (:link :rel "stylesheet" :href "/reveal/dist/theme/black.css")
         (:link :rel "stylesheet" :href "/reveal/dist/custom.css")
         (:link :rel "stylesheet" :href "/reveal/plugin/highlight/monokai.css")
         ,@(loop for s in styles collecting s))
        (:body
         ((:div :class "reveal")
          ((:div :class "slides")
           ,@(split-to-slides (rest doc))))
         (:script :src "/reveal/dist/reveal.js")
         (:script :src "/reveal/plugin/notes/notes.js")
         (:script :src "/reveal/plugin/markdown/markdown.js")
         (:script :src "/reveal/plugin/highlight/highlight.js")
         (:script
          (:noescape
           "// More info about initialization & config:
            // - https://revealjs.com/initialization/
            // - https://revealjs.com/config/
            Reveal.initialize({
              hash: true,
              // Learn about plugins: https://revealjs.com/plugins/
              plugins: [ RevealMarkdown, RevealHighlight, RevealNotes ]
            });")))))))


(defun split-to-slides (doc)
  (let ((sections ())
        (current ()))
    (dolist (e doc)
      (when (and current (or (eql (first e) :h1) (eql (first e) :h2)))
        (push  (cons :section (nreverse current)) sections)
        (setf current ()))
      (when (second e)
        (push e current)))
    (when current
      (push  (cons :section (nreverse current)) sections))
    (nreverse sections)))

(defun wrap-code (doc config)
  (declare (ignore config))
  (funcall (rewriter :pre #'code-wrapper) doc))

(defun fragments (doc config)
  (declare (ignore config))
  (funcall (rewriter :fragments #'fragmentize) doc))

(defun tdc (doc config)
  (declare (ignore config))
  (funcall (rewriter :tdc #'(lambda (e) `(:td :align "center" ,@(rest e)))) doc))

(defun fragmentize (e)
  "Turn the child elements into fragments. However treats lists (:ul and :ol)
specially, turning the list elements into the fragments. This does mean there's
no good way to make a whole list into a fragment."
  (let ((body (rest e)))
    (cond
      ((list-fragments-p body)
       `(,(caar body)
         ,@(mapcar #'(lambda (x) `(,(car x) :class "fragment" ,@(rest x))) (cdar body))))
      (t
       `(:progn
          ,@(mapcar #'(lambda (x) `(,(car x) :class "fragment" ,@(rest x))) body))))))

(defun list-fragments-p (body)
  (and (null (cdr body)) (member (caar body) '(:ul :ol))))

(defun code-wrapper (e)
  `(:pre
    ((:code :data-trim "" :data-noescape "" :class "language-javasscript")
     ,@(rest e))))
